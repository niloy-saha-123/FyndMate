/**
 * @file src/rate-limiting/redis-limiter.ts
 * @description Redis-based rate limiter (primary implementation)
 * 
 * Uses fixed-window algorithm with atomic INCR+EXPIRE operations.
 * 
 * TODO [5K Users]: Implement sliding window algorithm using sorted sets for more
 * accurate rate limiting at window boundaries (prevents burst attacks)
 * 
 * TODO [10K Users]: Use Lua scripts for atomic INCR+EXPIRE to prevent key leaks
 * if server crashes between INCR and EXPIRE calls
 */

import { Redis } from 'ioredis';
import { RateLimiter, RateLimitResult } from './types.js';

export class RedisRateLimiter implements RateLimiter {
    constructor(private redis: Redis) {}

    async check(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
        const rateLimitKey = `rl:${key}`;

        try {
            // Increment counter atomically
            const count = await this.redis.incr(rateLimitKey);

            // Set expiry on first request in window
            // TODO [10K Users]: Replace with Lua script to make this atomic
            if (count === 1) {
                await this.redis.expire(rateLimitKey, windowSec);
            }

            const allowed = count <= limit;
            const remaining = Math.max(0, limit - count);

            // Get TTL for retry-after header
            let retryAfter: number | undefined;
            if (!allowed) {
                const ttl = await this.redis.ttl(rateLimitKey);
                retryAfter = ttl > 0 ? ttl : windowSec;
            }

            return {
                allowed,
                remaining,
                retryAfter,
                limit,
                current: count,
            };
        } catch (error) {
            // Re-throw error to trigger fallback in hybrid limiter
            throw new Error(`Redis rate limit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getRemaining(key: string, limit: number, windowSec: number): Promise<number> {
        const rateLimitKey = `rl:${key}`;
        
        try {
            const count = await this.redis.get(rateLimitKey);
            if (!count) {
                return limit;
            }
            return Math.max(0, limit - parseInt(count, 10));
        } catch (error) {
            throw new Error(`Redis get remaining failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async reset(key: string): Promise<void> {
        const rateLimitKey = `rl:${key}`;
        
        try {
            await this.redis.del(rateLimitKey);
        } catch (error) {
            throw new Error(`Redis reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
