/**
 * @file src/app.ts
 * @description Main Fastify application factory. Creates and configures the Fastify
 *              instance with all plugins, middleware, and routes. This is the core
 *              of the server - it wires everything together but doesn't start listening.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { prisma } from './lib/prisma.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // ============================================
  // CORE PLUGINS
  // ============================================
  
  // CORS - Allow cross-origin requests from mobile app
  await app.register(cors, {
    origin: true,
  });

  // Multipart - File uploads
  await app.register(multipart);

  // ============================================
  // AUTH NOTE
  // ============================================
  // Authentication is handled via Supabase tokens.
  // Use middleware/auth.middleware.ts to verify tokens on protected routes.
  // No @fastify/jwt needed - Supabase handles JWT verification.

  // ============================================
  // DATABASE (no plugin)
  // ============================================
  // Prisma is imported directly where needed (no app.decorate / req.server usage)
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // ============================================
  // ROUTES (add as you build features)
  // ============================================
  
  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes will be added here:
  // await app.register(authRoutes, { prefix: '/api/auth' });
  // await app.register(userRoutes, { prefix: '/api/users' });
  // await app.register(matchRoutes, { prefix: '/api/matches' });
  // await app.register(messageRoutes, { prefix: '/api/messages' });

  return app;
}

