// src/lib/redis.ts
// Centralized Redis client for the application.
// Uses the REDIS_URL environment variable (e.g., redis://:password@host:6379/0).
import Redis from 'ioredis';

// Validate REDIS_URL in production
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is required in production');
}

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    // Connection timeout: fail fast if Redis is unavailable
    connectTimeout: 5000,
    // Command timeout: prevent hanging on slow operations
    commandTimeout: 3000,
    // Retry strategy: exponential backoff
    retryStrategy: (times: number) => {
        if (times > 3) {
            console.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
        }
        return Math.min(times * 200, 1000); // Max 1 second between retries
    },
    // Enable offline queue (buffer commands when disconnected)
    enableOfflineQueue: false, // Fail fast instead of queuing
    // Keep-alive to detect dead connections
    keepAlive: 30000,
    // Max retry time
    maxRetriesPerRequest: 2,
});

redis.on('error', (err: any) => {
    console.error('Redis error:', err);
});

redis.on('connect', () => {
    console.info('Redis connected successfully');
});

redis.on('ready', async () => {
    console.info('Redis ready to accept commands');

    // Configure Redis persistence and memory policies
    // TODO: For managed Redis (AWS ElastiCache, Upstash), configure these settings server-side instead
    try {
        // Enable RDB persistence: save snapshot every 5 minutes if at least 1 key changed
        await redis.config('SET', 'save', '300 1');

        // Set maxmemory policy: evict least recently used keys when memory limit reached
        await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');

        // Optional: Set maxmemory limit (adjust based on your Redis instance)
        // Default: commented out to use Redis server's configured value
        // await redis.config('SET', 'maxmemory', '256mb');

        console.info('Redis persistence and memory policies configured');
    } catch (err) {
        console.warn('Could not configure Redis policies (may need elevated permissions):', err);
        console.info('Ensure Redis server has: save 300 1, maxmemory-policy allkeys-lru');
    }
});

redis.on('reconnecting', () => {
    console.warn('Redis reconnecting...');
});

redis.on('close', () => {
    console.warn('Redis connection closed');
});

// TODO [10K Users]: Migrate to Redis Cluster or Managed Redis (AWS ElastiCache, Upstash) for high availability
// TODO [10K Users]: Add Prometheus metrics for Redis health (connection pool, hit rate, latency)
// TODO [10K Users]: Implement circuit breaker for Redis itself (fail-fast on timeout, fallback to in-memory)
// TODO [100K Users]: Add regional Redis replicas for multi-region deployments

export { redis };
