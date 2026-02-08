/**
 * @file src/rate-limiting/hybrid-limiter.ts
 * @description Hybrid rate limiter that gracefully degrades to in-memory fallback
 * 
 * Architecture:
 * 1. Prefer Redis (distributed, persistent, accurate)
 * 2. Fall back to in-memory if Redis is unhealthy or fails
 * 3. Monitor Redis health in background
 * 4. Auto-recover when Redis becomes healthy again
 * 
 * This approach ensures:
 * - Security: Always enforces rate limits (fail-closed)
 * - Reliability: Continues working even if Redis is down
 * - Performance: Uses fast in-memory cache when Redis is unavailable
 */

import { RedisRateLimiter } from './redis-limiter.js';
import { InMemoryRateLimiter } from './memory-limiter.js';
import { RedisHealthMonitor } from './health-monitor.js';
import { RateLimiter, RateLimitResult } from './types.js';

export class HybridRateLimiter implements RateLimiter {
    constructor(
        private redisLimiter: RedisRateLimiter,
        private memoryLimiter: InMemoryRateLimiter,
        private healthMonitor: RedisHealthMonitor
    ) {}

    async check(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
        // Try Redis first if healthy
        if (this.healthMonitor.isHealthy()) {
            try {
                const result = await this.redisLimiter.check(key, limit, windowSec);
                
                // Record success for health monitoring
                this.healthMonitor.recordSuccess();
                
                return result;
            } catch (error) {
                // Redis failed, record failure and fall through to in-memory
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.healthMonitor.recordFailure(errorMsg);
                
                console.warn('[HybridRateLimiter] Redis check failed, using in-memory fallback:', errorMsg);
                
                // TODO [2K Users]: Track fallback usage metrics for monitoring
                // Example: metrics.increment('rate_limiter.fallback_used');
            }
        }

        // Use in-memory fallback
        const result = await this.memoryLimiter.check(key, limit, windowSec);
        
        // Add metadata to indicate fallback was used
        console.debug('[HybridRateLimiter] Using in-memory fallback for key:', key);
        
        return result;
    }

    async getRemaining(key: string, limit: number, windowSec: number): Promise<number> {
        if (this.healthMonitor.isHealthy()) {
            try {
                return await this.redisLimiter.getRemaining(key, limit, windowSec);
            } catch (error) {
                // Fall through to in-memory
                console.warn('[HybridRateLimiter] Redis getRemaining failed, using in-memory fallback');
            }
        }

        return await this.memoryLimiter.getRemaining(key, limit, windowSec);
    }

    async reset(key: string): Promise<void> {
        // Reset in both stores to ensure consistency
        const promises = [
            this.memoryLimiter.reset(key),
        ];

        if (this.healthMonitor.isHealthy()) {
            promises.push(
                this.redisLimiter.reset(key).catch(err => {
                    console.warn('[HybridRateLimiter] Redis reset failed:', err.message);
                })
            );
        }

        await Promise.all(promises);
    }

    /**
     * Get current health status (for monitoring endpoint)
     */
    getHealthStatus() {
        return {
            redis: this.healthMonitor.getStatus(),
            inMemoryStoreSize: this.memoryLimiter.getStoreSize(),
        };
    }
}
