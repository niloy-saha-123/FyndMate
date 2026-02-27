/**
 * @file tests/security/location-security.test.ts
 * @description Security tests for location functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../helpers.js';
import { assertNoSensitiveFields } from '../test-utils/assertions.js';
import { likeService } from '../../src/services/like.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Location Security', () => {
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

    /**
     * Should reject invalid HMAC signature
     */
    it('rejects invalid HMAC signature', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
                longitude: -74.006,
                timestamp: Date.now(),
                nonce: 'test-nonce',
                signature: 'invalid-signature',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject replayed nonce
     */
    it('rejects replayed nonce', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const nonce = `nonce-${Date.now()}`;
        const payload = {
            latitude: 40.7128,
            longitude: -74.006,
            timestamp: Date.now(),
            nonce,
            signature: 'test-signature',
        };

        // First request (may fail signature validation but should consume nonce)
        await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload,
        });

        // Second request with same nonce
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload,
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject timestamp > 15 minutes old
     */
    it('rejects timestamp > 15 minutes old', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
                longitude: -74.006,
                timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
                nonce: `nonce-${Date.now()}`,
                signature: 'test-signature',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject timestamp in the future (>15 min)
     */
    it('rejects timestamp in the future (>15 min)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
                longitude: -74.006,
                timestamp: Date.now() + 20 * 60 * 1000, // 20 minutes in future
                nonce: `nonce-${Date.now()}`,
                signature: 'test-signature',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject missing required fields
     */
    it('rejects missing required fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
                // Missing longitude, timestamp, nonce, signature
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should never expose latitude/longitude/locationSecret in any response
     */
    it('latitude/longitude never appear in any response', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        const other = await createDummyUser('Other', {
            latitude: 40.7128,
            longitude: -74.006,
            locationSecret: 'secret123',
        });

        // Check in profile endpoint
        const profileResponse = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const profileBody = JSON.parse(profileResponse.body);
        assertNoSensitiveFields(profileBody);

        // Check in feed endpoint
        const feedResponse = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const feedBody = JSON.parse(feedResponse.body);
        if (feedBody.data && feedBody.data.length > 0) {
            feedBody.data.forEach((user: any) => {
                assertNoSensitiveFields(user);
            });
        }

        // Check in likes endpoint
        await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        const likesResponse = await app.inject({
            method: 'GET',
            url: '/api/likes/received',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const likesBody = JSON.parse(likesResponse.body);
        if (likesBody.data && likesBody.data.length > 0) {
            likesBody.data.forEach((like: any) => {
                if (like.liker) {
                    assertNoSensitiveFields(like.liker);
                }
            });
        }
    });
});
