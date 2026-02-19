/**
 * @file src/middleware/auth.middleware.ts
 * @description Authentication middleware that verifies Supabase JWTs and resolves User ID.
 * Handles auto-creation of user records for new sign-ups.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const AUTH_TOKEN_CACHE_TTL_SECONDS = 5 * 60;
const PERF_DEBUG_ENABLED = process.env.DEBUG_PERF_LOGS === '1';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;          // Database user ID (from User table)
      supabaseId: string;  // Supabase Auth ID  
      email?: string;
    };
  }
}

/**
 * Auth middleware that verifies Supabase JWT tokens.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authStartedAt = Date.now();
  let cacheHit = false;
  let cacheLookupMs = 0;
  let supabaseVerifyMs = 0;
  let dbLookupMs = 0;

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `auth:token:${tokenHash}`;

    try {
      const cacheLookupStartedAt = Date.now();
      const cached = await redis.get(cacheKey);
      cacheLookupMs = Date.now() - cacheLookupStartedAt;
      if (cached) {
        cacheHit = true;
        const parsed = JSON.parse(cached) as {
          id: string;
          supabaseId: string;
          email?: string;
          banned?: boolean;
        };

        if (parsed.banned) {
          return reply.status(403).send({ error: 'Account is banned' });
        }

        request.user = {
          id: parsed.id,
          supabaseId: parsed.supabaseId,
          email: parsed.email,
        };
        if (PERF_DEBUG_ENABLED) {
          request.log.info(
            {
              cacheHit,
              cacheLookupMs,
              totalAuthMs: Date.now() - authStartedAt,
            },
            'Auth middleware timing'
          );
        }
        return;
      }
    } catch {
      // Redis cache is best-effort for auth acceleration.
    }

    const verifyStartedAt = Date.now();
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    supabaseVerifyMs = Date.now() - verifyStartedAt;

    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Look up existing user — no write needed for returning users
    const dbLookupStartedAt = Date.now();
    let finalUser = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      select: { id: true, email: true, banned: true },
    });
    dbLookupMs = Date.now() - dbLookupStartedAt;

    // First request only: create user record with Supabase metadata defaults
    if (!finalUser) {
      // TODO [POST-MVP]: Stop fabricating placeholder emails; require email or store null explicitly.
      const email = data.user.email || `${data.user.id}@placeholder.local`;
      const name = data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        email.split('@')[0];
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      try {
        finalUser = await prisma.user.create({
          data: {
            supabaseId: data.user.id,
            email,
            name,
            timezone,
          },
          select: { id: true, email: true, banned: true },
        });
      } catch (createErr: any) {
        // Race condition: another concurrent request created the user first
        if (createErr.code === 'P2002') {
          finalUser = await prisma.user.findUnique({
            where: { supabaseId: data.user.id },
            select: { id: true, email: true, banned: true },
          });
          if (!finalUser) {
            return reply.status(500).send({ error: 'Authentication failed' });
          }
        } else {
          throw createErr;
        }
      }
    }

    if (finalUser.banned) {
      return reply.status(403).send({ error: 'Account is banned' });
    }

    // TODO: Session/device tracking and jti-based revocation (post-MVP).
    // Attach user to request
    request.user = {
      id: finalUser.id,
      supabaseId: data.user.id,
      email: finalUser.email,
    };

    await redis.setex(
      cacheKey,
      AUTH_TOKEN_CACHE_TTL_SECONDS,
      JSON.stringify({
        id: finalUser.id,
        supabaseId: data.user.id,
        email: finalUser.email,
        banned: finalUser.banned,
      })
    ).catch(() => {});

    if (PERF_DEBUG_ENABLED) {
      request.log.info(
        {
          cacheHit,
          cacheLookupMs,
          supabaseVerifyMs,
          dbLookupMs,
          totalAuthMs: Date.now() - authStartedAt,
        },
        'Auth middleware timing'
      );
    }
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}
