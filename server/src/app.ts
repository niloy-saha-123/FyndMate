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
import { redis } from './lib/redis.js';
import uploadRoutes from './routes/upload.routes.js';
import { locationRoutes } from './routes/location.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feed.routes.js';
import matchingRoutes from './routes/matching.routes.js';
import messageRoutes from './routes/message.routes.js';
import profileRoutes from './routes/profile.routes.js';
import notificationRoutes from './routes/notifications.routes.js';

const PERF_DEBUG_ENABLED = process.env.DEBUG_PERF_LOGS === '1';

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

  if (PERF_DEBUG_ENABLED) {
    app.addHook('onRequest', async (request) => {
      (request as any).__perfStartedAt = Date.now();
    });

    app.addHook('onResponse', async (request, reply) => {
      const startedAt = (request as any).__perfStartedAt as number | undefined;
      if (!startedAt) return;
      const durationMs = Date.now() - startedAt;
      app.log.info(
        {
          method: request.method,
          url: request.url,
          route: request.routeOptions?.url,
          statusCode: reply.statusCode,
          durationMs,
        },
        'Route timing'
      );
    });
  }

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    try {
      await redis.quit();
    } catch (err) {
      // Redis may already be disconnected or unavailable in local/test environments.
      app.log.warn({ err }, 'Redis quit failed during shutdown');
    }
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Redis health check endpoint
  // Redacted response: exposes only status, no internal details (failure counts, errors, store sizes)
  app.get('/health/redis', async (req, reply) => {
    try {
      const { rateLimiter } = await import('./rate-limiting/index.js');
      const healthStatus = (rateLimiter as any).getHealthStatus();

      return {
        status: healthStatus.redis.healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Routes
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(feedRoutes, { prefix: '/api/feed' });
  await app.register(matchingRoutes, { prefix: '/api' });
  await app.register(messageRoutes, { prefix: '/api' });
  await app.register(locationRoutes, { prefix: '/api' });
  await app.register(profileRoutes, { prefix: '/api' });
  await app.register(notificationRoutes, { prefix: '/api' });

  return app;
}
