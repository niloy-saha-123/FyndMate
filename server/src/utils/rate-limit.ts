/**
 * @file src/utils/rate-limit.ts
 * @description Simple in-memory rate limiter for upload endpoints.
 * Limits users to 5 uploads per hour to prevent spam.
 * 
 * ⚠️ LIMITATIONS (In-Memory, Per-Process):
 * - Limits are stored in-memory and reset on server restart
 * - Does NOT work with multiple server instances (each instance has its own limits)
 * - Not suitable for production with horizontal scaling
 * 
 * 🔄 PRODUCTION UPGRADE (Redis-based):
 * Replace Map-based storage with Redis for consistency across instances and restarts:
 * 
 * Implementation:
 * 1. Use Redis INCR command (atomic increment)
 * 2. Set TTL of 1 hour per userId key
 * 3. Check if count > 5, reject if exceeded
 * 
 * Example Redis commands:
 * ```redis
 * INCR upload_limit:{userId}
 * EXPIRE upload_limit:{userId} 3600
 * GET upload_limit:{userId}
 * ```
 * 
 * Benefits:
 * - Atomic operations ensure consistency
 * - TTL auto-expires keys (no cleanup needed)
 * - Works across multiple server instances
 * - Survives server restarts
 */

interface RateLimitRecord {
    count: number;   // Number of uploads made by the user
    resetAt: number; // Unix timestamp
  }
  
  // In-memory storage: userId -> rate limit record
  const uploadCounts = new Map<string, RateLimitRecord>();
  
  // Clean up expired records every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [userId, record] of uploadCounts.entries()) {
      if (now > record.resetAt) {
        uploadCounts.delete(userId);
      }
    }
  }, 10 * 60 * 1000);
  
  /**
   * Check if user has exceeded upload rate limit
   * @param userId - User's ID (from JWT)
   * @returns true if allowed, false if rate limit exceeded
   */
  export function checkUploadRateLimit(userId: string): boolean {
    const now = Date.now();
    const record = uploadCounts.get(userId);
  
    // No record or expired -> allow and start new window
    if (!record || now > record.resetAt) {
      uploadCounts.set(userId, {
        count: 1,
        resetAt: now + 3600000, // 1 hour from now
      });
      return true;
    }
  
    // Under limit -> increment and allow
    if (record.count < 5) {
      record.count++;
      return true;
    }
  
    // Over limit -> deny
    return false;
  }
  
  /**
   * Get remaining uploads for a user (for informational purposes)
   */
  export function getRemainingUploads(userId: string): number {
    const record = uploadCounts.get(userId);
    if (!record || Date.now() > record.resetAt) {
      return 5;
    }
    return Math.max(0, 5 - record.count);
  }