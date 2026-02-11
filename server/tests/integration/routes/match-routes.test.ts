/**
 * @file tests/integration/routes/match-routes.test.ts
 * @description Integration tests for match routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser, createUUID } from '../../helpers.js';
import { likeService } from '../../../src/services/like.service.js';
import { matchService } from '../../../src/services/match.service.js';
import { assertNoSensitiveFields } from '../../test-utils/assertions.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Match Routes', () => {
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
     * Should return { data, nextCursor } shape
     */
    it('GET /api/matches returns { data, nextCursor } shape', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/matches',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('nextCursor');
        expect(Array.isArray(body.data)).toBe(true);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/matches',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should not expose sensitive fields
     */
    it('does not expose sensitive fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other', {
            latitude: 40.7128,
            longitude: -74.006,
            locationSecret: 'secret123',
        });

        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');
        await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'GET',
            url: '/api/matches',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        if (body.data.length > 0) {
            assertNoSensitiveFields(body.data[0].user1);
            assertNoSensitiveFields(body.data[0].user2);
        }
    });

    /**
     * Should unmatch successfully for participant
     */
    it('POST /api/matches/:matchId/unmatch succeeds for participant', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'POST',
            url: `/api/matches/${match.id}/unmatch`,
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject non-participant
     */
    it('rejects non-participant', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');
        const user3 = await createDummyUser('User3');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);

        const token3 = await getAuthToken(user3.supabaseId, user3.email);

        const response = await app.inject({
            method: 'POST',
            url: `/api/matches/${match.id}/unmatch`,
            headers: {
                authorization: `Bearer ${token3}`,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const fakeId = createUUID();

        const response = await app.inject({
            method: 'POST',
            url: `/api/matches/${fakeId}/unmatch`,
        });

        expect(response.statusCode).toBe(401);
    });
});
