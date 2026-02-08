/**
 * @file src/rate-limiting/memory-limiter.ts
 * @description In-memory rate limiter as fallback when Redis is unavailable
 * 
 * LIMITATIONS:
 * - Only works on a single server instance
 * - Data is lost on server restart
 * - Not suitable for multi-server deployments without sticky sessions
 * 
 * TODO [5K Users]: Replace with distributed rate limiter (Redis Cluster, DragonflyDB)
 * TODO [10K Users]: Implement sliding window algorithm for more accurate limits
 */

import { RateLimiter, RateLimitResult } from './types.js';

interface RateLimitEntry {
    count: number;
    expiresAt: number; // Unix timestamp in milliseconds
}

export class InMemoryRateLimiter implements RateLimiter {
    private store = new Map<string, RateLimitEntry>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired entries every minute to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60_000);
        // Do not keep process alive solely for cleanup (use destroy on shutdown)
        this.cleanupInterval.unref();

        // TODO [10K Users]: Implement LRU cache with max size limit (e.g., 100K entries)
        // to prevent unbounded memory growth
    }

    async check(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
        const now = Date.now();
        const windowMs = windowSec * 1000;
        const rateLimitKey = `${key}:${limit}:${windowSec}`;

        const entry = this.store.get(rateLimitKey);

        // Entry expired or doesn't exist
        if (!entry || entry.expiresAt <= now) {
            const newEntry: RateLimitEntry = {
                count: 1,
                expiresAt: now + windowMs,
            };
            this.store.set(rateLimitKey, newEntry);

            return {
                allowed: true,
                remaining: limit - 1,
                limit,
                current: 1,
            };
        }

        // Increment count
        entry.count++;
        this.store.set(rateLimitKey, entry);

        const allowed = entry.count <= limit;
        const remaining = Math.max(0, limit - entry.count);
        const retryAfter = allowed ? undefined : Math.ceil((entry.expiresAt - now) / 1000);

        return {
            allowed,
            remaining,
            retryAfter,
            limit,
            current: entry.count,
        };
    }

    async getRemaining(key: string, limit: number, windowSec: number): Promise<number> {
        const rateLimitKey = `${key}:${limit}:${windowSec}`;
        const entry = this.store.get(rateLimitKey);
        
        if (!entry || entry.expiresAt <= Date.now()) {
            return limit;
        }

        return Math.max(0, limit - entry.count);
    }

    async reset(key: string): Promise<void> {
        // Delete all entries starting with this key
        for (const k of this.store.keys()) {
            if (k.startsWith(key)) {
                this.store.delete(k);
            }
        }
    }

    /**
     * Clean up expired entries to prevent memory leaks
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.info(`[InMemoryRateLimiter] Cleaned up ${cleaned} expired entries`);
        }

        // TODO [10K Users]: Log memory usage and alert if it exceeds threshold
        // Example: if (this.store.size > 50000) { alertDevOps(); }
    }

    /**
     * Get current store size (for monitoring)
     */
    getStoreSize(): number {
        return this.store.size;
    }

    /**
     * Cleanup on shutdown
     */
    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}
