/**
 * @file src/middleware/auth.middleware.ts
 * @description Authentication middleware that verifies Supabase JWTs and resolves User ID.
 * Handles auto-creation of user records for new sign-ups.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { prisma } from '../lib/prisma.js';

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
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Look up existing user — no write needed for returning users
    let finalUser = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      select: { id: true, email: true, banned: true },
    });

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
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}
