/**
 * @file src/middleware/auth.middleware.ts
 * @description Authentication middleware for protected routes. Verifies JWT tokens
 *              issued by Supabase Auth and attaches the authenticated user to the
 *              request object. Use as preHandler on routes that require authentication.
 * 
 * @example
 * // Protect a route:
 * app.get('/api/profile', { preHandler: [authMiddleware] }, handler);
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      // Add other fields from Supabase user as needed
    };
  }
}

/**
 * Auth middleware that verifies Supabase JWT tokens
 * 
 * Usage in routes:
 * ```ts
 * app.get('/api/protected', { preHandler: [authMiddleware] }, handler);
 * ```
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ error: 'No authorization header' });
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    // Verify the JWT with Supabase
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Attach user to request for use in handlers
    request.user = {
      id: data.user.id,
      email: data.user.email,
    };
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}

