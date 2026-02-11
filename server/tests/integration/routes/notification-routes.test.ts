/**
 * @file tests/integration/routes/notification-routes.test.ts
 * @description Integration tests for notification routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser, createUUID } from '../../helpers.js';
import { likeService } from '../../../src/services/like.service.js';
import { matchService } from '../../../src/services/match.service.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Notification Routes', () => {
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
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            payload: {
                receiverUserId: createUUID(),
                message: 'Test notification',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject missing receiverUserId
     */
    it('rejects missing receiverUserId', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                message: 'Test notification',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject missing message
     */
    it('rejects missing message', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                receiverUserId: other.id,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject self-notification
     */
    it('rejects self-notification', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                receiverUserId: me!.id,
                message: 'Test notification',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Cannot notify self');
    });

    /**
     * Should reject non-matched user
     */
    it('rejects non-matched user', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const stranger = await createDummyUser('Stranger');

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                receiverUserId: stranger.id,
                message: 'Test notification',
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should return success: false when no push token
     */
    it('returns { success: false, reason: no_push_token } when no token', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');

        // Create match
        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');
        await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                receiverUserId: other.id,
                message: 'Test notification',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.reason).toBe('no_push_token');
    });

    /**
     * Should reject message > 200 chars
     */
    it('rejects message > 200 chars', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/notifications/send',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                receiverUserId: other.id,
                message: 'a'.repeat(201),
            },
        });

        expect(response.statusCode).toBe(400);
    });
});

describe('PATCH /api/notifications/push-token', () => {
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

    it('saves push token successfully', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/notifications/push-token',
            headers: {
                authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            payload: { pushToken: 'ExponentPushToken[test-token-123]' },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
    });

    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/notifications/push-token',
            headers: { 'Content-Type': 'application/json' },
            payload: { pushToken: 'ExponentPushToken[test]' },
        });

        expect(response.statusCode).toBe(401);
    });

    it('rejects missing pushToken', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/notifications/push-token',
            headers: {
                authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            payload: {},
        });

        expect(response.statusCode).toBe(400);
    });
});

describe('GET /api/notifications/preferences/:matchId', () => {
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

    it('returns preference for participant', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');
        const like = await likeService.createLike(other.id, me!.id, true, 'Hi');
        const match = await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'GET',
            url: `/api/notifications/preferences/${match.id}`,
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('enabled');
        expect(typeof body.enabled).toBe('boolean');
    });

    it('rejects non-participant', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');
        const like = await likeService.createLike(user1.id, user2.id, true, 'Hi');
        const match = await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'GET',
            url: `/api/notifications/preferences/${match.id}`,
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(403);
    });
});

describe('PUT /api/notifications/preferences/:matchId', () => {
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

    it('sets preference successfully', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');
        const like = await likeService.createLike(other.id, me!.id, true, 'Hi');
        const match = await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'PUT',
            url: `/api/notifications/preferences/${match.id}`,
            headers: {
                authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            payload: { enabled: false },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.enabled).toBe(false);

        const getRes = await app.inject({
            method: 'GET',
            url: `/api/notifications/preferences/${match.id}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(getRes.statusCode).toBe(200);
        expect(JSON.parse(getRes.body).enabled).toBe(false);
    });

    it('rejects non-participant', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');
        const like = await likeService.createLike(user1.id, user2.id, true, 'Hi');
        const match = await matchService.acceptLike(like.id);

        const response = await app.inject({
            method: 'PUT',
            url: `/api/notifications/preferences/${match.id}`,
            headers: {
                authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            payload: { enabled: false },
        });

        expect(response.statusCode).toBe(403);
    });
});
