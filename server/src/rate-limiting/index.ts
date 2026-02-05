/**
 * @file src/rate-limiting/index.ts
 * @description Main entry point for rate limiting system
 * 
 * Exports a singleton instance of the hybrid rate limiter.
 */

import { redis } from '../lib/redis.js';
import { RedisRateLimiter } from './redis-limiter.js';
import { InMemoryRateLimiter } from './memory-limiter.js';
import { RedisHealthMonitor } from './health-monitor.js';
import { HybridRateLimiter } from './hybrid-limiter.js';

// Create singleton instances
const redisLimiter = new RedisRateLimiter(redis);
const memoryLimiter = new InMemoryRateLimiter();
const healthMonitor = new RedisHealthMonitor(redis);

// Start health monitoring
healthMonitor.startMonitoring();

// Export the hybrid limiter as the default rate limiter
export const rateLimiter = new HybridRateLimiter(
    redisLimiter,
    memoryLimiter,
    healthMonitor
);

// Export individual components for testing
export { RedisRateLimiter } from './redis-limiter.js';
export { InMemoryRateLimiter } from './memory-limiter.js';
export { RedisHealthMonitor } from './health-monitor.js';
export { HybridRateLimiter } from './hybrid-limiter.js';
export type { RateLimiter, RateLimitResult, HealthStatus } from './types.js';

// Cleanup on shutdown
process.on('SIGTERM', () => {
    console.info('[RateLimiting] Shutting down...');
    healthMonitor.stopMonitoring();
    memoryLimiter.destroy();
});

process.on('SIGINT', () => {
    console.info('[RateLimiting] Shutting down...');
    healthMonitor.stopMonitoring();
    memoryLimiter.destroy();
});
