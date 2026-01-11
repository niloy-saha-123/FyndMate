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
import rateLimit from '@fastify/rate-limit';
import { prisma } from './lib/prisma.js';
import uploadRoutes from './routes/upload.routes.js';
import { locationRoutes } from './routes/location.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feed.routes.js';
import matchingRoutes from './routes/matching.routes.js';

/**
 * ============================================
 * TODO: PRODUCTION MONITORING SETUP
 * ============================================
 * 
 * Before deploying to production with real users, add monitoring to catch
 * errors and track performance. Recommended: Sentry (free tier: 5k events/month)
 * 
 * Step 1: Install Sentry
 *   npm install @sentry/node @sentry/profiling-node
 * 
 * Step 2: Add to .env:
 *   SENTRY_DSN=https://your-key@sentry.io/your-project-id
 *   NODE_ENV=production
 * 
 * Step 3: Initialize Sentry (add BEFORE buildApp):
 *   import * as Sentry from '@sentry/node';
 *   import { ProfilingIntegration } from '@sentry/profiling-node';
 *   
 *   if (process.env.NODE_ENV === 'production') {
 *     Sentry.init({
 *       dsn: process.env.SENTRY_DSN,
 *       environment: process.env.NODE_ENV,
 *       integrations: [new ProfilingIntegration()],
 *       tracesSampleRate: 0.1,  // 10% of requests (saves quota)
 *       profilesSampleRate: 0.1, // 10% profiling
 *     });
 *   }
 * 
 * Step 4: Add error handler to Fastify (in buildApp function):
 *   app.setErrorHandler((error, request, reply) => {
 *     // Log to Sentry in production
 *     if (process.env.NODE_ENV === 'production') {
 *       Sentry.captureException(error, {
 *         user: { id: request.user?.id },
 *         tags: { endpoint: request.url },
 *       });
 *     }
 *     
 *     request.log.error(error);
 *     reply.status(500).send({ error: 'Internal server error' });
 *   });
 * 
 * What you get:
 * - Email/Slack alerts when errors occur
 * - Stack traces with exact line numbers
 * - User context (who hit the error)
 * - Performance monitoring (slow endpoints)
 * - Error trends (which errors are most common)
 * 
 * Pricing:
 * - Free tier: 5,000 errors/month (plenty for MVP)
 * - Team plan: $26/month for 50k errors (when scaling)
 * 
 * Alternatives:
 * - Sentry: Best for error tracking (recommended)
 * - Datadog: Best for metrics + logs (expensive)
 * - New Relic: All-in-one APM (expensive)
 * - LogRocket: Session replay + errors (for frontend)
 */

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // ============================================
  // CORE PLUGINS
  // ============================================

  /**
   * CORS (Cross-Origin Resource Sharing) Configuration
   * 
   * CURRENT (DEVELOPMENT):
   * - origin: true → Allows requests from ANY domain
   * - Good for development (works with localhost, Expo dev server, etc.)
   * 
   * ⚠️ TODO: PRODUCTION SETUP (When we deploy with a domain)
   * 
   * Step 1: Add to .env file:
   *   ALLOWED_ORIGINS=https://fyndmate.com,https://www.fyndmate.com,https://app.fyndmate.com
   *   NODE_ENV=production
   * 
   * Step 2: Replace 'origin: true' below with:
   *   const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
   *   
   *   origin: process.env.NODE_ENV === 'production' 
   *     ? allowedOrigins  // Production: whitelist only your domains
   *     : true,           // Development: allow all (for testing)
   * 
   * Why this matters:
   * - Without whitelist: evil-site.com can make requests to your API
   * - With whitelist: Only YOUR domains can make requests
   * 
   * Security: Prevents CSRF attacks where malicious sites try to use
   * the user's logged-in session to upload malware or steal data.
   */
  await app.register(cors, {
    origin: true, // TODO: Replace with whitelist when deploying (see comments above)
  });

  // Multipart - File uploads
  await app.register(multipart);

  /**
   * Rate Limiting
   * 
   * CURRENT: In-memory store (good for single server)
   * Limits: 100 requests per 15 minutes per IP
   * 
   * ⚠️ TODO: USE REDIS FOR PRODUCTION (Multiple Servers)
   * 
   * PROBLEM: In-memory rate limiting breaks with load balancers.
   * If you have 2+ servers, each tracks limits separately, so a user
   * could make 100 requests to Server A and 100 to Server B = 200 total.
   * 
   * SOLUTION: Use Redis as shared rate limit store
   * 
   * Example Redis rate limiting:
   * ```typescript
   * import Redis from 'ioredis';
   * 
   * const redis = new Redis({
   *   host: process.env.REDIS_HOST || 'localhost',
   *   port: parseInt(process.env.REDIS_PORT || '6379'),
   *   password: process.env.REDIS_PASSWORD
   * });
   * 
   * await app.register(rateLimit, {
   *   global: true,
   *   max: 100,
   *   timeWindow: '15 minutes',
   *   redis: redis, // ← Shared store across all servers
   *   nameSpace: 'fyndmate-rl:',
   *   continueExceeding: true,
   *   skipOnError: false
   * });
   * ```
   * 
   * Cost: Same Redis instance as nonce storage ($5/month)
   * Timeline: Implement before deploying multiple server instances
   */
  await app.register(rateLimit, {
    global: true,
    max: 100, // 100 requests
    timeWindow: '15 minutes', // per 15 minutes
    // Per-IP tracking (prevents single user from spamming)
  });

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
  // ROUTES (add as we build features)
  // ============================================

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Upload routes (profile pictures)
  // Endpoints:
  //   POST /api/upload/profile-picture/request - Get signed upload URL
  //   POST /api/upload/profile-picture/confirm - Confirm upload and save to DB
  await app.register(uploadRoutes, { prefix: '/api/upload' });

  // Auth routes (signup, etc.)
  await app.register(authRoutes, { prefix: '/auth' });

  // Matching Engine Routes
  await app.register(feedRoutes, { prefix: '/api/feed' });
  await app.register(matchingRoutes, { prefix: '/api' });
  // Register location update endpoint
  await app.register(locationRoutes, { prefix: '/api' });
  // await app.register(userRoutes, { prefix: '/api/users' });
  // await app.register(messageRoutes, { prefix: '/api/messages' });

  return app;
}

