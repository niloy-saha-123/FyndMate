/**
 * @file tests/security/authorization.test.ts
 * @description Security tests for authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../helpers.js';
import { likeService } from '../../src/services/like.service.js';
import { matchService } from '../../src/services/match.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Authorization Security', () => {
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
     * Should create likes from authenticated user's ID (not arbitrary)
     */
    it('likes created from authenticated user ID (not arbitrary)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hello there!',
            },
        });

        const like = await prisma.like.findFirst({
            where: { likedId: other.id },
        });

        expect(like?.likerId).toBe(me!.id);
    });

    /**
     * Should not accept someone else's like
     */
    it('cannot accept someone else like', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');
        const user3 = await createDummyUser('User3');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        const token3 = await getAuthToken(user3.supabaseId, user3.email);

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${like.id}/accept`,
            headers: {
                authorization: `Bearer ${token3}`,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should not unmatch someone else's match
     */
    it('cannot unmatch someone else match', async () => {
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
     * Should not confirm someone else's upload
     */
    it('cannot confirm someone else upload', async () => {
        const user1 = await createDummyUser('User1');
        const token1 = await getAuthToken(user1.supabaseId, user1.email);

        // Request upload
        const requestResponse = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token1}`,
            },
            payload: {
                fileExtension: 'jpg',
            },
        });

        const { uploadPath } = JSON.parse(requestResponse.body);

        // Different user tries to confirm
        const user2 = await createDummyUser('User2');
        const token2 = await getAuthToken(user2.supabaseId, user2.email);

        const confirmResponse = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token2}`,
            },
            payload: {
                uploadPath,
            },
        });

        expect(confirmResponse.statusCode).toBe(403);
    });

    /**
     * Should not access other user's profile data (private fields)
     */
    it('cannot access other user profile data', async () => {
        const user1 = await createDummyUser('User1', {
            locationSecret: 'secret123',
        });
        const token2 = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: `/api/profile/${user1.id}`,
            headers: {
                authorization: `Bearer ${token2}`,
            },
        });

        if (response.statusCode === 200) {
            const body = JSON.parse(response.body);
            expect(body).not.toHaveProperty('locationSecret');
        }
    });
});
