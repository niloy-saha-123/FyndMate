/**
 * @file src/app.ts
 * @description Main Fastify application factory. Configures plugins, middleware, and routes.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { sanitizeLocationResponse } from './middleware/sanitizeLocation.js';
import { prisma } from './lib/prisma.js';
import uploadRoutes from './routes/upload.routes.js';
import { locationRoutes } from './routes/location.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feed.routes.js';
import matchingRoutes from './routes/matching.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // TODO: Add Sentry or similar monitoring for production
  // TODO: Configure stricter CORS whitelist for production
  await app.register(cors, {
    origin: true,
  });

  // Multipart - File uploads
  await app.register(multipart);

  /**
   * Rate Limiting
   * All rate limiting is handled by custom Redis-backed middleware (src/middleware/rateLimit.ts)
   * Applied per-route with configurable limits. See:
   * - Feed routes: 60 req/min
   * - Location updates: 10 req/hour
   * - Swipe actions: 100 req/12 hours
   * - Upload requests: 5 req/hour
   */

  /**
   * Response Sanitization
   * Strips sensitive location fields (lat, long, secret) from all responses.
   */
  app.addHook('onSend', sanitizeLocationResponse);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Routes
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(feedRoutes, { prefix: '/api/feed' });
  await app.register(matchingRoutes, { prefix: '/api' });
  await app.register(locationRoutes, { prefix: '/api' });

  return app;
}

