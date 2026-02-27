/**
 * @file tests/unit/rate-limiting/memory-limiter.test.ts
 * @description Unit tests for in-memory rate limiter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryRateLimiter } from '../../../src/rate-limiting/memory-limiter.js';

describe('InMemoryRateLimiter', () => {
    let limiter: InMemoryRateLimiter;

    beforeEach(() => {
        limiter = new InMemoryRateLimiter();
    });

    afterEach(() => {
        limiter.destroy();
    });

    /**
     * Should allow first request with remaining = limit - 1
     */
    it('first request is allowed (remaining = limit - 1)', async () => {
        const result = await limiter.check('test-key', 5, 60);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
        expect(result.limit).toBe(5);
        expect(result.current).toBe(1);
    });

    /**
     * Should track remaining correctly after multiple checks
     */
    it('tracks remaining correctly after multiple checks', async () => {
        await limiter.check('test-key', 3, 60);
        await limiter.check('test-key', 3, 60);
        const result = await limiter.check('test-key', 3, 60);

        expect(result.remaining).toBe(0);
        expect(result.current).toBe(3);
    });

    /**
     * Should block after limit exceeded
     */
    it('blocks after limit exceeded (allowed = false)', async () => {
        await limiter.check('test-key', 2, 60);
        await limiter.check('test-key', 2, 60);
        const result = await limiter.check('test-key', 2, 60);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    /**
     * Should return retryAfter when blocked
     */
    it('returns retryAfter when blocked', async () => {
        await limiter.check('test-key', 1, 60);
        const result = await limiter.check('test-key', 1, 60);

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    /**
     * Should clear entries for key on reset
     */
    it('reset() clears entries for key', async () => {
        await limiter.check('test-key', 2, 60);
        await limiter.reset('test-key');

        const result = await limiter.check('test-key', 2, 60);
        expect(result.current).toBe(1);
        expect(result.remaining).toBe(1);
    });

    /**
     * Should return correct store size
     */
    it('getStoreSize() returns correct count', async () => {
        await limiter.check('key1', 5, 60);
        await limiter.check('key2', 5, 60);
        await limiter.check('key3', 5, 60);

        const size = limiter.getStoreSize();
        expect(size).toBe(3);
    });
});
