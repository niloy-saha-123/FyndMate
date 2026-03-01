/**
 * @file tests/integration/routes/message-routes.test.ts
 * @description Integration tests for message routes: match status, messages, block, unblock, hide.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { likeService } from '../../../src/services/like.service.js';
import { matchService } from '../../../src/services/match.service.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Message Routes', () => {
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

    async function setupMatch() {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const other = await createDummyUser('Other');
        const like = await likeService.createLike(other.id, me!.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);
        return { token, me: me!, other, match };
    }

    describe('GET /api/matches/:matchId', () => {
        it('returns match status for participant', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('status', 'active');
            expect(body).toHaveProperty('blockedBy');
            expect(body).toHaveProperty('otherUserId');
        });

        it('rejects non-participant', async () => {
            const { match } = await setupMatch();
            const outsider = await createDummyUser('Outsider');
            const outsiderToken = await getAuthToken(outsider.supabaseId, outsider.email);

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}`,
                headers: { authorization: `Bearer ${outsiderToken}` },
            });

            expect(response.statusCode).toBe(403);
        });

        it('rejects without auth', async () => {
            const { match } = await setupMatch();

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}`,
            });

            expect(response.statusCode).toBe(401);
        });

        it('rejects malformed match ID', async () => {
            const { token } = await setupMatch();

            const response = await app.inject({
                method: 'GET',
                url: '/api/matches/not-a-uuid',
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(403);
        });
    });

    describe('GET /api/matches/:matchId/messages', () => {
        it('returns messages for participant', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}/messages`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('data');
            expect(Array.isArray(body.data)).toBe(true);
            // Intro message from liker was created on accept
            expect(body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('rejects non-participant', async () => {
            const { match } = await setupMatch();
            const outsider = await createDummyUser('Outsider');
            const outsiderToken = await getAuthToken(outsider.supabaseId, outsider.email);

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}/messages`,
                headers: { authorization: `Bearer ${outsiderToken}` },
            });

            expect(response.statusCode).toBe(403);
        });
        it('hides old-cycle messages after unmatch and rematch', async () => {
            const { token, me, other, match } = await setupMatch();

            const oldMessage = await prisma.message.create({
                data: {
                    matchId: match.id,
                    senderId: me.id,
                    content: 'Old-cycle message',
                },
            });

            await matchService.unmatch(match.id, me.id);

            const relike = await likeService.createLike(
                other.id,
                me.id,
                true,
                'Starting fresh'
            );
            await matchService.acceptLike(relike.id);

            const refreshedMatch = await prisma.match.findUnique({
                where: { id: match.id },
                select: { conversationStartAt: true },
            });
            expect(refreshedMatch).not.toBeNull();

            const response = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}/messages`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const messages = body.data;
            const messageIds = messages.map((m: any) => m.id);
            expect(messageIds).not.toContain(oldMessage.id);

            const boundaryMs = new Date(refreshedMatch!.conversationStartAt).getTime();
            expect(
                messages.every((m: any) => new Date(m.createdAt).getTime() >= boundaryMs)
            ).toBe(true);
        });
    });

    describe('POST /api/matches/:matchId/messages', () => {
        it('sends message successfully', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/messages`,
                headers: {
                    authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                payload: { content: 'Hello from test!' },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.body);
            expect(body.content).toBe('Hello from test!');
            expect(body).toHaveProperty('id');
            expect(body).toHaveProperty('senderId');
            expect(body).toHaveProperty('createdAt');
        });

        it('rejects empty message', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/messages`,
                headers: {
                    authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                payload: { content: '' },
            });

            expect(response.statusCode).toBe(400);
        });

        it('rejects message exceeding length limit', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/messages`,
                headers: {
                    authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                payload: { content: 'a'.repeat(2001) },
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('PATCH /api/matches/:matchId/messages/:messageId', () => {
        it('edits message within 5-minute window', async () => {
            const { token, me, match } = await setupMatch();
            const msg = await prisma.message.create({
                data: {
                    matchId: match.id,
                    senderId: me.id,
                    content: 'Original message',
                },
            });

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/matches/${match.id}/messages/${msg.id}`,
                headers: {
                    authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                payload: { content: 'Edited message' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.content).toBe('Edited message');
            expect(body).toHaveProperty('editedAt');
        });

        it('rejects edit by non-sender', async () => {
            const { token, other, match } = await setupMatch();
            const msg = await prisma.message.create({
                data: {
                    matchId: match.id,
                    senderId: other.id,
                    content: 'Other user message',
                },
            });

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/matches/${match.id}/messages/${msg.id}`,
                headers: {
                    authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                payload: { content: 'Trying to edit other message' },
            });

            expect(response.statusCode).toBe(403);
        });
    });

    describe('POST /api/matches/:matchId/block', () => {
        it('blocks match successfully', async () => {
            const { token, me, other, match } = await setupMatch();
            const messageCountBefore = await prisma.message.count({
                where: { matchId: match.id },
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/block`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);

            const blockedMatch = await prisma.match.findUnique({
                where: { id: match.id },
            });
            expect(blockedMatch).not.toBeNull();
            expect(blockedMatch?.status).toBe('blocked');
            expect(blockedMatch?.blockedBy).toBe(me.id);

            const messageCountAfter = await prisma.message.count({
                where: { matchId: match.id },
            });
            expect(messageCountAfter).toBe(messageCountBefore);

            const block = await prisma.block.findUnique({
                where: {
                    blockerId_blockedId: {
                        blockerId: me.id,
                        blockedId: other.id,
                    },
                },
            });
            expect(block).not.toBeNull();
        });

        it('rejects non-participant', async () => {
            const { match } = await setupMatch();
            const outsider = await createDummyUser('Outsider');
            const outsiderToken = await getAuthToken(outsider.supabaseId, outsider.email);

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/block`,
                headers: { authorization: `Bearer ${outsiderToken}` },
            });

            expect(response.statusCode).toBe(403);
        });
    });

    describe('POST /api/matches/:matchId/unblock', () => {
        it('unblocks match for user who blocked', async () => {
            const { token, me, match } = await setupMatch();
            await matchService.blockMatch(match.id, me.id);

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/unblock`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);

            const statusRes = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}`,
                headers: { authorization: `Bearer ${token}` },
            });
            const status = JSON.parse(statusRes.body);
            expect(status.status).toBe('active');
            expect(status.blockedBy).toBeNull();
        });

        it('rejects unblock by non-blocker', async () => {
            const { token, me, other, match } = await setupMatch();
            await matchService.blockMatch(match.id, me.id);

            const otherToken = await getAuthToken(other.supabaseId, other.email);

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/unblock`,
                headers: { authorization: `Bearer ${otherToken}` },
            });

            expect(response.statusCode).toBe(403);
        });
    });

    describe('POST /api/matches/:matchId/hide', () => {
        it('hides match successfully', async () => {
            const { token, match } = await setupMatch();

            const response = await app.inject({
                method: 'POST',
                url: `/api/matches/${match.id}/hide`,
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);

            const statusRes = await app.inject({
                method: 'GET',
                url: `/api/matches/${match.id}`,
                headers: { authorization: `Bearer ${token}` },
            });
            const status = JSON.parse(statusRes.body);
            expect(status.status).toBe('hidden');
        });
    });
});
