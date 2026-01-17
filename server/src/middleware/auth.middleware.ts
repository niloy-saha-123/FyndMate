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
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { prisma } from '../lib/prisma.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;          // Database user ID (from User table)
      supabaseId: string;  // Supabase Auth ID  
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

    // ============================================
    // IDENTITY RESOLUTION: Auth ID → Database ID
    // ============================================
    // 
    // WHY THIS IS NEEDED:
    // - Supabase Auth uses its own UUIDs (data.user.id)
    // - Our database User table has separate primary key (id)
    // - Foreign keys reference User.id (database PK), not supabaseId
    // 
    // CURRENT APPROACH (MVP - Good for 0-10k users):
    // - Lookup database user on every authenticated request
    // - Performance: ~5-15ms per request (indexed lookup)
    // - Cost: 1 database query per auth request
    // 
    // WHEN TO OPTIMIZE:
    // 
    // Phase 1 (Current): 0-10k users, <1k RPS
    //   ✅ Keep this simple lookup - it's fast enough
    // 
    // Phase 2: 10k-100k users, 1k-10k RPS
    //   ⚠️ Add Redis caching:
    //   const cached = await redis.get(`user:${data.user.id}`);
    //   if (cached) return JSON.parse(cached);
    //   // ... existing lookup ...
    //   await redis.setex(`user:${data.user.id}`, 3600, JSON.stringify(dbUser));
    // 
    // Phase 3: 100k+ users, 10k+ RPS
    //   ⚠️ Embed database ID in JWT custom claims:
    //   // During user creation:
    //   supabase.auth.admin.createUser({
    //     app_metadata: { db_user_id: dbUser.id }
    //   });
    //   // In middleware (no DB lookup):
    //   request.user.id = data.user.app_metadata.db_user_id;
    // 
    // MONITORING:
    // If auth latency >20ms consistently, move to next phase
    // 
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },  // Indexed lookup by Supabase Auth ID
      select: { id: true, email: true },     // Only fetch what we need
    });

    // ============================================
    // AUTO-CREATE USER IF NOT EXISTS
    // ============================================
    // User exists in Supabase Auth but not in database.
    // This can happen on first login. Auto-create the user row
    // with data from the JWT to ensure a seamless experience.
    let finalUser = dbUser;
    
    if (!dbUser) {
      request.log.info({ supabaseId: data.user.id }, 'Auto-creating user row for new Supabase user');
      
      try {
        // Extract user metadata from Supabase JWT
        const email = data.user.email || `${data.user.id}@placeholder.local`;
        const name = data.user.user_metadata?.full_name || 
                     data.user.user_metadata?.name || 
                     email.split('@')[0];
        
        // Detect timezone from request or use default
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        
        // Create user row with minimal required fields
        finalUser = await prisma.user.create({
          data: {
            supabaseId: data.user.id,
            email: email,
            name: name,
            timezone: timezone,
            // All other fields have defaults or are optional
          },
          select: { id: true, email: true },
        });
        
        request.log.info({ userId: finalUser.id, supabaseId: data.user.id }, 'Successfully auto-created user');
      } catch (createError: any) {
        // Handle race condition: user might have been created between findUnique and create
        if (createError.code === 'P2002') {
          // Unique constraint violation - user was created by another request
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

    // Attach user to request for use in handlers
    // IMPORTANT: request.user.id is the DATABASE id (for foreign keys)
    // NOT the Supabase Auth ID - this enables proper referential integrity
    request.user = {
      id: finalUser.id,            // Database primary key (use this for foreign keys)
      supabaseId: data.user.id, // Supabase Auth UUID (for reference/logging)
      email: finalUser.email,
    };
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}

