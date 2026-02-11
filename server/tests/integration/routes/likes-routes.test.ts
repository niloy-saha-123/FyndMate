/**
 * @file tests/integration/routes/likes-routes.test.ts
 * @description Integration tests for likes routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { likeService } from '../../../src/services/like.service.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Likes Routes', () => {
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
     * Should create like and return 200 with matched: false
     */
    it('POST /api/likes creates like, returns 200 { matched: false, like }', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        const response = await app.inject({
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

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.matched).toBe(false);
        expect(body.like).toHaveProperty('id');
    });

    /**
     * Should reject non-UUID likedId
     */
    it('rejects non-UUID likedId', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: 'not-a-uuid',
                liked: true,
                message: 'Hello there!',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject missing message when liked=true
     */
    it('rejects missing message when liked=true', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject message < 10 chars
     */
    it('rejects message < 10 chars', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hi!',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should allow pass without message
     */
    it('allows pass without message', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: false,
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hello there!',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should return matched: true for instant match
     */
    it('returns { matched: true } for instant match', async () => {
        const user1 = await createDummyUser('User1');
        const token1 = await getAuthToken(user1.supabaseId, user1.email);

        const user2 = await createDummyUser('User2');
        const token2 = await getAuthToken(user2.supabaseId, user2.email);

        // User1 likes User2
        await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { authorization: `Bearer ${token1}` },
            payload: {
                likedId: user2.id,
                liked: true,
                message: 'Hello from user1!',
            },
        });

        // User2 likes User1 (instant match)
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { authorization: `Bearer ${token2}` },
            payload: {
                likedId: user1.id,
                liked: true,
                message: 'Hi back from user2!',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.matched).toBe(true);
        expect(body.match).toHaveProperty('id');
    });

    /**
     * Should prevent duplicate likes
     */
    it('prevents duplicate likes', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { authorization: `Bearer ${token}` },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hello there!',
            },
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { authorization: `Bearer ${token}` },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hello again!',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should return received likes
     */
    it('GET /api/likes/received returns 200 with likes', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        const response = await app.inject({
            method: 'GET',
            url: '/api/likes/received',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
    });

    /**
     * Should wrap received likes in { data: [...] }
     */
    it('wraps in { data: [...] }', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/likes/received',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('data');
    });

    /**
     * Should reject GET /api/likes/received without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/likes/received',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should accept like and create match
     */
    it('POST /api/likes/:likeId/accept returns 200 creates match', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${like.id}/accept`,
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                replyMessage: 'Hi back!',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('match');
    });

    /**
     * Should reject non-owner accepting like
     */
    it('rejects non-owner', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');
        const token2 = await getAuthToken(user2.supabaseId, user2.email);

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        // User1 tries to accept (but they're the liker, not the likedUser)
        const token1 = await getAuthToken(user1.supabaseId, user1.email);

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${like.id}/accept`,
            headers: {
                authorization: `Bearer ${token1}`,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should reject accepting non-existent like
     */
    it('rejects non-existent like', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const fakeId = crypto.randomUUID();

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${fakeId}/accept`,
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(404);
    });

    /**
     * Should decline like
     */
    it('POST /api/likes/:likeId/decline returns 200 archives like', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${like.id}/decline`,
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject non-owner declining like
     */
    it('rejects non-owner', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        const token1 = await getAuthToken(user1.supabaseId, user1.email);

        const response = await app.inject({
            method: 'POST',
            url: `/api/likes/${like.id}/decline`,
            headers: {
                authorization: `Bearer ${token1}`,
            },
        });

        expect(response.statusCode).toBe(403);
    });
});
