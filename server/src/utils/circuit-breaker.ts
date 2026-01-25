/**
 * @file src/utils/circuit-breaker.ts
 * @description Simple circuit breaker for external API calls (e.g., geocoding).
 * 
 * Prevents cascading failures when external services are down by:
 * - Tracking failure rate
 * - Opening circuit after threshold failures
 * - Auto-recovering after cooldown period
 */

import { redis } from '../lib/redis.js';

// TODO [10K Users]: Increase failureThreshold to 10-20 and add half-open state for gradual recovery testing
// TODO [10K Users]: Add Prometheus metrics for circuit breaker state changes and failure rates

interface CircuitBreakerOptions {
    failureThreshold: number; // Number of failures before opening circuit
    cooldownSeconds: number;  // Time to wait before trying again
    windowSeconds: number;    // Time window for counting failures
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,   // Open after 5 failures
    cooldownSeconds: 60,   // Wait 1 minute before retry
    windowSeconds: 300,    // Count failures in 5-minute window
};

/**
 * Check if circuit is open (service is considered down)
 * Fails open if Redis is unavailable (allows request through)
 */
export async function isCircuitOpen(serviceName: string): Promise<boolean> {
    try {
        const key = `circuit:${serviceName}:open`;
        const isOpen = await redis.get(key);
        return isOpen === '1';
    } catch (err) {
        console.error('Redis error in circuit breaker check, failing open:', err);
        return false; // Fail open - allow request if Redis is unavailable
    }
}

/**
 * Record a successful call (resets failure count)
 */
export async function recordSuccess(serviceName: string): Promise<void> {
    try {
        const failKey = `circuit:${serviceName}:failures`;
        const openKey = `circuit:${serviceName}:open`;

        await redis.del(failKey);
        await redis.del(openKey);
    } catch (err) {
        console.error('Redis error in circuit breaker recordSuccess:', err);
        // Non-critical: circuit may stay open longer than needed
    }
}

/**
 * Record a failed call (increments failure count, may open circuit)
 */
export async function recordFailure(
    serviceName: string,
    options: Partial<CircuitBreakerOptions> = {}
): Promise<void> {
    try {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const failKey = `circuit:${serviceName}:failures`;
        const openKey = `circuit:${serviceName}:open`;

        const failureCount = await redis.incr(failKey);

        // Set expiry on first failure
        // TODO: Replace INCR+EXPIRE with atomic Lua script to prevent key leaks on server crash
        if (failureCount === 1) {
            await redis.expire(failKey, opts.windowSeconds);
        }

        // Open circuit if threshold exceeded
        if (failureCount >= opts.failureThreshold) {
            await redis.set(openKey, '1', 'EX', opts.cooldownSeconds);
            console.warn(`Circuit breaker opened for ${serviceName} after ${failureCount} failures`);
        }
    } catch (err) {
        console.error('Redis error in circuit breaker recordFailure:', err);
        // Non-critical: circuit won't track failures, but original error still propagates
    }
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback: () => T,
    options?: Partial<CircuitBreakerOptions>
): Promise<T> {
    // Check if circuit is open
    if (await isCircuitOpen(serviceName)) {
        console.warn(`Circuit breaker is open for ${serviceName}, using fallback`);
        return fallback();
    }

    try {
        const result = await fn();
        await recordSuccess(serviceName);
        return result;
    } catch (error) {
        await recordFailure(serviceName, options);
        throw error;
    }
}
