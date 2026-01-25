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

    // Identity Resolution: Map Supabase Auth ID to Database User ID
    // We purposefully check the DB on every request to ensure recent bans/deletions are respected.
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      select: { id: true, email: true },
    });

    let finalUser = dbUser;

    // Auto-create user if they exist in Auth but not in DB (e.g. first login)
    if (!dbUser) {
      request.log.info({ supabaseId: data.user.id }, 'Auto-creating user row for new Supabase user');

      try {
        const email = data.user.email || `${data.user.id}@placeholder.local`;
        const name = data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          email.split('@')[0];

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        finalUser = await prisma.user.create({
          data: {
            supabaseId: data.user.id,
            email: email,
            name: name,
            timezone: timezone,
          },
          select: { id: true, email: true },
        });

        request.log.info({ userId: finalUser.id, supabaseId: data.user.id }, 'Successfully auto-created user');
      } catch (createError: any) {
        // Handle race condition: user might have been created between findUnique and create
        if (createError.code === 'P2002') {
          request.log.info({ supabaseId: data.user.id }, 'User already created by concurrent request, fetching...');
          finalUser = await prisma.user.findUnique({
            where: { supabaseId: data.user.id },
            select: { id: true, email: true },
          });

          if (!finalUser) {
            request.log.error({ supabaseId: data.user.id }, 'Failed to find or create user');
            return reply.status(500).send({ error: 'Failed to create user account' });
          }
        } else {
          request.log.error(createError, 'Failed to auto-create user');
          return reply.status(500).send({ error: 'Failed to create user account' });
        }
      }
    }

    if (!finalUser) {
      request.log.error({ supabaseId: data.user.id }, 'Unexpected: failed to resolve user');
      return reply.status(500).send({ error: 'Failed to resolve user account' });
    }

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

