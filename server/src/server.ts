/**
 * @file src/server.ts
 * @description Entry point for the server. Bootstraps the Fastify application
 *              and starts listening on the configured port. This file should
 *              contain minimal logic - just startup and error handling.
 */

import { buildApp } from './app.js';
import { checkRedisHealth } from './lib/redis.js';

const start = async () => {
  try {
    // CRITICAL: Check Redis health before starting server
    // This ensures we fail fast if Redis is misconfigured
    console.info('🔍 Checking Redis health...');
    await checkRedisHealth();
    
    // Build Fastify app (this also initializes rate limiting system)
    const app = await buildApp();

    // Start listening
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info(`✅ Server started successfully on port ${port}`);
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('');
    console.info('Health endpoints:');
    console.info(`  • General: http://localhost:${port}/health`);
    console.info(`  • Redis:   http://localhost:${port}/health/redis`);
    console.info('');
    
    // TODO [1K Users]: Add startup health check for database connection
    // TODO [2K Users]: Add startup health check for Supabase connectivity
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();

