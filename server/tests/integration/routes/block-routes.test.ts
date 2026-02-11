/**
 * @file tests/integration/routes/block-routes.test.ts
 * @description Integration tests for block routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { likeService } from '../../../src/services/like.service.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Block Routes', () => {
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
     * Should block user after interaction
     */
    it('POST /api/users/block blocks user after interaction', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                userId: other.id,
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject non-UUID userId
     */
    it('rejects non-UUID userId', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                userId: 'not-a-uuid',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject blocking without prior interaction
     */
    it('rejects without prior interaction', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const stranger = await createDummyUser('Stranger');

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                userId: stranger.id,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            payload: {
                userId: other.id,
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject blocking self
     */
    it('rejects blocking self', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                userId: me!.id,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should be idempotent (second block returns 200)
     */
    it('idempotent (second block returns 200)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: { authorization: `Bearer ${token}` },
            payload: { userId: other.id },
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: { authorization: `Bearer ${token}` },
            payload: { userId: other.id },
        });

        expect(response.statusCode).toBe(200);
    });
});
