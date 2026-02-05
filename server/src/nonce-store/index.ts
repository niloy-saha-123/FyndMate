/**
 * @file src/nonce-store/index.ts
 * @description Main entry point for nonce storage system
 * 
 * Exports a singleton instance of the hybrid nonce store.
 * Shares the same health monitor as the rate limiter for consistency.
 */

import { redis } from '../lib/redis.js';
import { RedisNonceStore } from './redis-store.js';
import { InMemoryNonceStore } from './memory-store.js';
import { HybridNonceStore } from './hybrid-store.js';

// Import health monitor from rate limiting system (shared instance)
import { rateLimiter } from '../rate-limiting/index.js';

// Create singleton instances
const redisStore = new RedisNonceStore(redis);
const memoryStore = new InMemoryNonceStore();

// Use the same health monitor as rate limiter for consistency
const healthMonitor = (rateLimiter as any).healthMonitor;

// Export the hybrid store as the default nonce store
export const nonceStore = new HybridNonceStore(
    redisStore,
    memoryStore,
    healthMonitor
);

// Export individual components for testing
export { RedisNonceStore } from './redis-store.js';
export { InMemoryNonceStore } from './memory-store.js';
export { HybridNonceStore } from './hybrid-store.js';
export type { NonceStore } from './types.js';

// Cleanup on shutdown
process.on('SIGTERM', () => {
    console.info('[NonceStore] Shutting down...');
    memoryStore.destroy();
});

process.on('SIGINT', () => {
    console.info('[NonceStore] Shutting down...');
    memoryStore.destroy();
});
