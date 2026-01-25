/**
 * @file src/utils/rate-limit.ts
 * @description Redis-based rate limiter for upload endpoints.
 * Limits users to 5 uploads per hour to prevent spam.
 */

import { redis } from '../lib/redis.js';

const UPLOAD_LIMIT = 5;
const WINDOW_SECONDS = 3600; // 1 hour

// TODO [10K Users]: Implement sliding-window rate limiting to prevent boundary attacks
// TODO [100K Users]: Migrate to distributed rate limiting (Token Bucket with Redis Lua scripts)
// TODO: Replace INCR+EXPIRE with atomic Lua script to prevent key leaks on server crash

/**
 * Check if user has exceeded upload rate limit using Redis
 * @param userId - User's ID (from JWT)
 * @returns true if allowed, false if rate limit exceeded
 */
export async function checkUploadRateLimit(userId: string): Promise<boolean> {
  try {
    const key = `rl:upload:${userId}`;
    const count = await redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    return count <= UPLOAD_LIMIT;
  } catch (err) {
    console.error('Redis error in upload rate limiter:', err);
    // TODO [10K Users]: Add fallback in-memory rate limiting instead of failing open
    return true; // Fail open on Redis error
  }
}

/**
 * Get remaining uploads for a user (for informational purposes)
 */
export async function getRemainingUploads(userId: string): Promise<number> {
  try {
    const key = `rl:upload:${userId}`;
    const count = await redis.get(key);

    if (!count) {
      return UPLOAD_LIMIT;
    }

    return Math.max(0, UPLOAD_LIMIT - parseInt(count, 10));
  } catch (err) {
    console.error('Redis error getting remaining uploads:', err);
    return UPLOAD_LIMIT; // Assume full quota on error
  }
}

/**
 * Get TTL (seconds until reset) for upload rate limit
 */
export async function getUploadRateLimitTTL(userId: string): Promise<number> {
  try {
    const key = `rl:upload:${userId}`;
    const ttl = await redis.ttl(key);
    return ttl > 0 ? ttl : WINDOW_SECONDS;
  } catch (err) {
    console.error('Redis error getting upload TTL:', err);
    return WINDOW_SECONDS;
  }
}