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

    const email = data.user.email || `${data.user.id}@placeholder.local`;
    const name = data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      email.split('@')[0];
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Idempotent resolution: upsert avoids race conditions on concurrent first requests
    const finalUser = await prisma.user.upsert({
      where: { supabaseId: data.user.id },
      update: {
        email,
        name,
        timezone,
      },
      create: {
        supabaseId: data.user.id,
        email,
        name,
        timezone,
      },
      select: { id: true, email: true, banned: true },
    });

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
