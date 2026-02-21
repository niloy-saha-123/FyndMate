/**
 * @file src/routes/message.routes.ts
 * @description API routes for messages and match status (block/unblock/hide).
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { messageService } from '../services/message.service.js';
import { matchService } from '../services/match.service.js';
import { blockService } from '../services/block.service.js';
import { sendMessagePush } from '../services/push.service.js';
import {
    sendMessageSchema,
    editMessageSchema,
    messageIdParamSchema,
} from '../schemas/message.schema.js';
import { matchIdParamSchema } from '../schemas/matching.schema.js';

export default async function messageRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // --- Match status (for messages screen) ---

    // GET /api/matches/:matchId - Returns { status, blockedBy } for participants
    app.get(
        '/matches/:matchId',
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const { matchId } = paramsResult.data;

            try {
                const match = await matchService.getMatchStatus(matchId, user.id);
                return reply.send(match);
            } catch (err: any) {
                if (err.message === 'Match not found' || err.message === 'Not authorized') {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to fetch match' });
            }
        }
    );

    // --- Messages ---

    // GET /api/matches/:matchId/messages
    app.get(
        '/matches/:matchId/messages',
        {
            preHandler: [
                rateLimit({ limit: 60, windowSec: 60, keyPrefix: 'message_msg' }),
            ],
        },
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const { matchId } = paramsResult.data;

            try {
                const messages = await messageService.getMessages(matchId, user.id);
                return reply.send(messages);
            } catch (err: any) {
                if (err.message === 'Match not found' || err.message === 'Not authorized') {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to fetch messages' });
            }
        }
    );

    // POST /api/matches/:matchId/messages
    app.post(
        '/matches/:matchId/messages',
        {
            preHandler: [
                rateLimit({ limit: 60, windowSec: 60, keyPrefix: 'message_msg' }),
            ],
        },
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const bodyResult = sendMessageSchema.safeParse(request.body);
            if (!bodyResult.success) {
                const first = bodyResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid message',
                });
            }
            const { matchId } = paramsResult.data;
            const { content } = bodyResult.data;

            try {
                const message = await messageService.sendMessage(
                    matchId,
                    user.id,
                    content
                );
                // Send push notification to receiver (fire-and-forget; do not block response)
                sendMessagePush({ matchId, senderId: user.id, content }).catch((err) => {
                    request.log.warn({ err, matchId }, 'Push notification failed');
                });
                return reply.status(201).send(message);
            } catch (err: any) {
                if (
                    err.message === 'Match not found' ||
                    err.message === 'Not authorized' ||
                    err.message.includes('not active')
                ) {
                    return reply.status(403).send({ error: err.message });
                }
                if (err.message.includes('cannot be empty') || err.message.includes('exceed')) {
                    return reply.status(400).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to send message' });
            }
        }
    );

    // PATCH /api/matches/:matchId/messages/:messageId
    app.patch(
        '/matches/:matchId/messages/:messageId',
        {
            preHandler: [
                rateLimit({ limit: 30, windowSec: 60, keyPrefix: 'message_edit' }),
            ],
        },
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema
                .merge(messageIdParamSchema)
                .safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid parameters',
                });
            }
            const bodyResult = editMessageSchema.safeParse(request.body);
            if (!bodyResult.success) {
                const first = bodyResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid message',
                });
            }
            const { messageId } = paramsResult.data;
            const { content } = bodyResult.data;

            try {
                const message = await messageService.editMessage(
                    messageId,
                    user.id,
                    content
                );
                return reply.send(message);
            } catch (err: any) {
                if (
                    err.message === 'Message not found' ||
                    err.message === 'Not authorized' ||
                    err.message.includes('not active') ||
                    err.message.includes('previous conversation') ||
                    err.message.includes('5 minutes')
                ) {
                    return reply.status(403).send({ error: err.message });
                }
                if (err.message.includes('cannot be empty') || err.message.includes('exceed')) {
                    return reply.status(400).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to edit message' });
            }
        }
    );

    // PATCH /api/matches/:matchId/messages/:messageId/delete
    app.patch(
        '/matches/:matchId/messages/:messageId/delete',
        {
            preHandler: [
                rateLimit({ limit: 30, windowSec: 60, keyPrefix: 'message_delete' }),
            ],
        },
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema
                .merge(messageIdParamSchema)
                .safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid parameters',
                });
            }
            const { messageId } = paramsResult.data;

            try {
                const message = await messageService.deleteMessage(
                    messageId,
                    user.id
                );
                return reply.send(message);
            } catch (err: any) {
                if (
                    err.message === 'Message not found' ||
                    err.message === 'Not authorized' ||
                    err.message.includes('not active') ||
                    err.message.includes('previous conversation') ||
                    err.message.includes('5 minutes') ||
                    err.message.includes('already deleted')
                ) {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to delete message' });
            }
        }
    );

    // --- Match status (block / unblock / hide) ---

    // POST /api/matches/:matchId/block
    app.post(
        '/matches/:matchId/block',
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const { matchId } = paramsResult.data;

            try {
                const matchStatus = await matchService.getMatchStatus(matchId, user.id);
                await blockService.blockUser(user.id, matchStatus.otherUserId);
                return reply.send({ success: true });
            } catch (err: any) {
                if (err.message === 'Not authorized' || err.message === 'Match not found') {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to block match' });
            }
        }
    );

    // POST /api/matches/:matchId/unblock
    app.post(
        '/matches/:matchId/unblock',
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const { matchId } = paramsResult.data;

            try {
                await matchService.unblockMatch(matchId, user.id);
                return reply.send({ success: true });
            } catch (err: any) {
                if (err.message === 'Match not found' || err.message === 'Not authorized') {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to unblock match' });
            }
        }
    );

    // POST /api/matches/:matchId/hide
    app.post(
        '/matches/:matchId/hide',
        async (request, reply) => {
            const user = request.user!;
            const paramsResult = matchIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
                const first = paramsResult.error.issues[0];
                return reply.status(400).send({
                    error: 'Validation failed',
                    message: first?.message || 'Invalid match ID',
                });
            }
            const { matchId } = paramsResult.data;

            try {
                await matchService.hideMatch(matchId, user.id);
                return reply.send({ success: true });
            } catch (err: any) {
                if (err.message === 'Not authorized') {
                    return reply.status(403).send({ error: err.message });
                }
                request.log.error(err);
                return reply.status(500).send({ error: 'Failed to hide match' });
            }
        }
    );
}
