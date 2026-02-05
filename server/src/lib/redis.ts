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

// TODO [5K Users]: Migrate to managed Redis with SLA (Upstash Pro, AWS ElastiCache, Redis Cloud)
// TODO [10K Users]: Implement Redis Cluster for high availability and automatic failover
// TODO [10K Users]: Add Prometheus metrics for Redis health (connection pool, hit rate, latency)
// TODO [100K Users]: Add regional Redis replicas for multi-region deployments

/**
 * Check Redis health at server startup
 * CRITICAL: This runs during server initialization to catch configuration issues early
 */
export async function checkRedisHealth(): Promise<void> {
    try {
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;
        
        console.info(`✅ Redis connected successfully (latency: ${latency}ms)`);
        
        // TODO [2K Users]: Alert if Redis latency is consistently >100ms
        if (latency > 100) {
            console.warn(`⚠️  Redis latency is high (${latency}ms). Consider upgrading Redis instance.`);
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🚨 WARNING: Redis is NOT available');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('Impact:');
        console.error('  • Rate limiting: Using in-memory fallback (single-server only)');
        console.error('  • Nonce validation: Using in-memory fallback (replay protection limited)');
        console.error('  • Feed caching: Disabled (slower performance)');
        console.error('  • Circuit breaker: Disabled');
        console.error('');
        console.error('Error:', errorMsg);
        console.error('');
        console.error('To fix:');
        console.error('  1. Check REDIS_URL in .env file');
        console.error('  2. Verify Redis server is running');
        console.error('  3. For local dev: Use Upstash free tier (https://upstash.com)');
        console.error('');
        
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ FATAL: Redis is REQUIRED in production');
            console.error('   Server will not start without Redis to ensure security.');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            process.exit(1); // Force crash in production to prevent security bypass
        }
        
        console.error('⚠️  Server will start in DEGRADED mode (dev environment only)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}

export { redis };
