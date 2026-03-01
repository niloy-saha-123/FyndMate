/**
 * @file tests/integration/rate-limits.test.ts
 * @description Integration tests for per-endpoint rate limiting (likes, uploads).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../helpers.js';
import { LIKES_RATE_LIMIT } from '../../src/schemas/validation-constants.js';

describe('Rate Limits', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    it('enforces likes daily limit with 429 on the next request', async () => {
        const token = await getAuthToken('liker', 'liker@example.com');

        // Create unique targets to avoid duplicate-like validation errors
        const targets = await Promise.all(
            Array.from({ length: LIKES_RATE_LIMIT + 1 }).map((_, idx) =>
                createDummyUser(`Target${idx + 1}`)
            )
        );

        let lastStatus = 200;
        for (let i = 0; i < targets.length; i++) {
            const res = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: { authorization: `Bearer ${token}` },
                payload: {
                    likedId: targets[i].id,
                    liked: true,
                    message: 'Hello there!', // >= INTRO_MESSAGE_MIN_LENGTH
                },
            });
            lastStatus = res.statusCode;
        }

        expect(lastStatus).toBe(429);
    });

    it('enforces upload request limit (5 per hour)', async () => {
        const token = await getAuthToken('uploader', 'uploader@example.com');

        let statusCodes: number[] = [];
        for (let i = 0; i < 6; i++) {
            const res = await app.inject({
                method: 'POST',
                url: '/api/upload/profile-picture/request',
                headers: { authorization: `Bearer ${token}` },
                payload: { fileExtension: 'jpg' },
            });
            statusCodes.push(res.statusCode);
        }

        expect(statusCodes.slice(0, 5).every((c) => c === 200)).toBe(true);
        expect(statusCodes[5]).toBe(429);
    });
});
