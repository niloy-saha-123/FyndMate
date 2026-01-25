/**
 * @file src/middleware/rateLimit.ts
 * @description Simple Redis-backed fixed-window rate limiter middleware.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../lib/redis.js';

interface RateLimitOptions {
    limit: number; // max requests per window
    windowSec: number; // window size in seconds
    keyPrefix: string; // prefix for the Redis key, e.g., 'loc' or 'upload'
}

// TODO [10K Users]: Implement sliding-window rate limiting to prevent boundary attacks
// TODO [100K Users]: Migrate to distributed rate limiting (Token Bucket with Redis Lua scripts)
// TODO: Replace INCR+EXPIRE with atomic Lua script to prevent key leaks on server crash

export function rateLimit(opts: RateLimitOptions) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        // Assuming auth middleware has attached user.id to the request
        const userId = (req as any).user?.id;
        const identifier = userId ?? req.ip; // fallback to IP if no user
        const key = `rl:${opts.keyPrefix}:${identifier}`;

        try {
            const count = await redis.incr(key);
            if (count === 1) {
                await redis.expire(key, opts.windowSec);
            }

            if (count > opts.limit) {
                // Get TTL to calculate Retry-After
                const ttl = await redis.ttl(key);
                const retryAfter = ttl > 0 ? ttl : opts.windowSec;

                // Structured logging for rate limit violations
                req.log.warn({
                    event: 'rate_limit_exceeded',
                    userId: userId || 'anonymous',
                    ip: req.ip,
                    endpoint: req.url,
                    action: opts.keyPrefix,
                    limit: opts.limit,
                    window: opts.windowSec,
                    count: count,
                    retryAfter: retryAfter,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString(),
                }, 'Rate limit exceeded');

                return reply
                    .status(429)
                    .header('Retry-After', retryAfter.toString())
                    .header('X-RateLimit-Limit', opts.limit.toString())
                    .header('X-RateLimit-Remaining', '0')
                    .header('X-RateLimit-Reset', (Date.now() + (retryAfter * 1000)).toString())
                    .send({
                        error: 'Too many requests – please try again later.',
                        retryAfter: retryAfter,
                        limit: opts.limit,
                        window: opts.windowSec,
                    });
            }

            // Add rate limit headers to successful requests
            const remaining = Math.max(0, opts.limit - count);
            reply.header('X-RateLimit-Limit', opts.limit.toString());
            reply.header('X-RateLimit-Remaining', remaining.toString());

        } catch (err) {
            // Redis failure: log error and fail open (allow request)
            req.log.error({
                event: 'rate_limit_redis_error',
                error: err,
                userId: userId || 'anonymous',
                ip: req.ip,
                endpoint: req.url,
                action: opts.keyPrefix,
            }, 'Redis error in rate limiter - failing open');

            // TODO [10K Users]: Add fallback in-memory rate limiting instead of failing open
            // For now, allow the request to proceed
        }
    };
}
