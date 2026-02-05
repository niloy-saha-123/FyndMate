/**
 * @file src/rate-limiting/types.ts
 * @description Type definitions for the rate limiting system
 */

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Number of requests remaining in the window */
    remaining: number;
    /** Seconds until the rate limit resets */
    retryAfter?: number;
    /** Total limit for this window */
    limit: number;
    /** Current count (for debugging) */
    current: number;
}

/**
 * Rate limiter interface - allows swapping implementations
 */
export interface RateLimiter {
    /**
     * Check if a request should be allowed
     * @param key - Unique identifier (userId, IP, etc.)
     * @param limit - Max requests allowed in window
     * @param windowSec - Time window in seconds
     * @returns Result indicating if request is allowed
     */
    check(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;

    /**
     * Get remaining quota for a key (optional, for display purposes)
     * @param key - Unique identifier
     * @param limit - Max requests allowed
     * @param windowSec - Time window
     * @returns Number of requests remaining
     */
    getRemaining?(key: string, limit: number, windowSec: number): Promise<number>;

    /**
     * Reset rate limit for a key (admin/testing purposes)
     * @param key - Unique identifier
     */
    reset?(key: string): Promise<void>;
}

/**
 * Health status of the rate limiter backend
 */
export interface HealthStatus {
    healthy: boolean;
    consecutiveFailures: number;
    lastChecked: Date;
    lastError?: string;
}
