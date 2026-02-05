/**
 * @file src/utils/rate-limit.ts
 * @description Upload-specific rate limiting utilities using hybrid rate limiter
 */

import { rateLimiter } from '../rate-limiting/index.js';

const UPLOAD_LIMIT = 5;
const WINDOW_SECONDS = 3600; // 1 hour

// TODO [2K Users]: Increase upload limit to 10/hour for verified users
// TODO [5K Users]: Implement tiered limits based on user reputation/activity

/**
 * Check if user has exceeded upload rate limit
 * Uses hybrid Redis/in-memory rate limiter for reliability
 * 
 * @param userId - User's ID (from JWT)
 * @returns true if allowed, false if rate limit exceeded
 */
export async function checkUploadRateLimit(userId: string): Promise<boolean> {
  try {
    const result = await rateLimiter.check(
      `upload:${userId}`,
      UPLOAD_LIMIT,
      WINDOW_SECONDS
    );
    
    return result.allowed;
  } catch (err) {
    // Critical failure: fail closed for security
    console.error('🚨 Upload rate limiter failed:', err);
    return false;
  }
}

/**
 * Get remaining uploads for a user (for informational purposes)
 * 
 * @param userId - User's ID
 * @returns Number of uploads remaining in current window
 */
export async function getRemainingUploads(userId: string): Promise<number> {
  try {
    return await rateLimiter.getRemaining(
      `upload:${userId}`,
      UPLOAD_LIMIT,
      WINDOW_SECONDS
    );
  } catch (err) {
    console.error('Error getting remaining uploads:', err);
    // On error, return conservative estimate
    return 0;
  }
}

/**
 * Get TTL (seconds until reset) for upload rate limit
 * 
 * @param userId - User's ID
 * @returns Seconds until rate limit resets
 */
export async function getUploadRateLimitTTL(userId: string): Promise<number> {
  try {
    // Check current limit to get retry-after value
    const result = await rateLimiter.check(
      `upload:${userId}`,
      UPLOAD_LIMIT,
      WINDOW_SECONDS
    );
    
    return result.retryAfter || WINDOW_SECONDS;
  } catch (err) {
    console.error('Error getting upload TTL:', err);
    // Return default window on error
    return WINDOW_SECONDS;
  }
}