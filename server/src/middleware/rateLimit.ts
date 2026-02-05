/**
 * @file src/middleware/rateLimit.ts
 * @description Hybrid rate limiter middleware with Redis + in-memory fallback
 * 
 * Uses the hybrid rate limiting system that automatically falls back to in-memory
 * when Redis is unavailable, ensuring rate limits are ALWAYS enforced (fail-closed).
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { rateLimiter } from '../rate-limiting/index.js';

interface RateLimitOptions {
    limit: number; // max requests per window
    windowSec: number; // window size in seconds
    keyPrefix: string; // prefix for the key, e.g., 'loc' or 'upload'
}

/**
 * Rate limiting middleware factory
 * 
 * Creates a middleware that enforces rate limits using hybrid Redis/in-memory system.
 * Always fails closed - if both Redis and in-memory fail, request is rejected.
 * 
 * TODO [5K Users]: Add per-endpoint rate limit budgets (e.g., upload = 5/hr, feed = 60/min)
 * TODO [10K Users]: Implement token bucket algorithm for burst tolerance
 */
export function rateLimit(opts: RateLimitOptions) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        // Get identifier: prefer userId, fallback to IP for anonymous requests
        const userId = (req as any).user?.id;
        const identifier = userId ?? req.ip;
        const key = `${opts.keyPrefix}:${identifier}`;

        try {
            // Check rate limit using hybrid system
            const result = await rateLimiter.check(key, opts.limit, opts.windowSec);

            // Add standard rate limit headers
            reply.header('X-RateLimit-Limit', opts.limit.toString());
            reply.header('X-RateLimit-Remaining', result.remaining.toString());

            if (!result.allowed) {
                // Rate limit exceeded
                const retryAfter = result.retryAfter || opts.windowSec;
                
                // Structured logging for monitoring and abuse detection
                req.log.warn({
                    event: 'rate_limit_exceeded',
                    userId: userId || 'anonymous',
                    ip: req.ip,
                    endpoint: req.url,
                    action: opts.keyPrefix,
                    limit: opts.limit,
                    window: opts.windowSec,
                    current: result.current,
                    retryAfter: retryAfter,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString(),
                }, 'Rate limit exceeded');

                // TODO [1K Users]: Track rate limit violations per user for abuse detection
                // TODO [2K Users]: Implement progressive penalties (longer lockouts for repeat offenders)

                return reply
                    .status(429)
                    .header('Retry-After', retryAfter.toString())
                    .header('X-RateLimit-Reset', (Date.now() + (retryAfter * 1000)).toString())
                    .send({
                        error: 'Too many requests',
                        message: `You can only make ${opts.limit} requests per ${opts.windowSec} seconds. Please try again later.`,
                        retryAfter: retryAfter,
                        limit: opts.limit,
                        window: opts.windowSec,
                    });
            }

            // Request allowed, continue to next handler
        } catch (error) {
            // Critical failure: Both Redis AND in-memory fallback failed
            // This should never happen, but if it does, fail closed for security
            req.log.error({
                event: 'rate_limit_critical_failure',
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: userId || 'anonymous',
                ip: req.ip,
                endpoint: req.url,
                action: opts.keyPrefix,
            }, '🚨 CRITICAL: Rate limiter completely failed - rejecting request');

            // Fail closed: Reject request to maintain security
            return reply.status(503).send({
                error: 'Service temporarily unavailable',
                message: 'Please try again in a few moments.',
            });
        }
    };
}
