/**
 * @file src/routes/matching.routes.ts
 * @description API Routes for Likes, Matches, and Blocking.
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { likeService } from '../services/like.service.js';
import { matchService } from '../services/match.service.js';
import { blockService } from '../services/block.service.js';
import {
    createLikeSchema,
    acceptLikeSchema,
    likeIdParamSchema,
    matchIdParamSchema,
    blockUserSchema,
} from '../schemas/matching.schema.js';
import {
    LIKES_RATE_LIMIT,
    LIKES_RATE_LIMIT_WINDOW_SECONDS,
} from '../schemas/validation-constants.js';

export default async function matchingRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authMiddleware);

    // Likes
    app.post('/likes', {
        preHandler: [
            rateLimit({ limit: LIKES_RATE_LIMIT, windowSec: LIKES_RATE_LIMIT_WINDOW_SECONDS, keyPrefix: 'swipe' })
        ]
    }, async (request, reply) => {
        const user = request.user!;

        const parseResult = createLikeSchema.safeParse(request.body);
        if (!parseResult.success) {
            const firstIssue = parseResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid request',
                field: firstIssue?.path.join('.') || 'unknown',
            });
        }

        const { likedId, liked, message } = parseResult.data;

        try {
            const result = await likeService.createLike(user.id, likedId, liked, message);
            const matched = (result as any).user1Id !== undefined && (result as any).user2Id !== undefined;
            return reply.send({
                matched,
                match: matched ? result : null,
                like: matched ? null : result,
            });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    app.get('/likes/received', async (request, reply) => {
        const user = request.user!;
        const { limit, cursor } = request.query as { limit?: string; cursor?: string };
        const parsedLimit = limit ? parseInt(limit, 10) : 20;

        try {
            const likes = await likeService.getReceivedLikes(user.id, parsedLimit, cursor);
            return reply.send({ data: likes });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch likes' });
        }
    });

    app.post('/likes/:likeId/accept', async (request, reply) => {
        const user = request.user!;

        // Log the incoming likeId for debugging
        const params = request.params as { likeId?: string };
        request.log.info({ likeId: params.likeId }, 'Accept like request received');

        const paramsResult = likeIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
            const firstIssue = paramsResult.error.issues[0];
            request.log.error({ params: request.params, error: paramsResult.error }, 'Like ID validation failed');
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid like ID',
            });
        }

        const bodyResult = acceptLikeSchema.safeParse(request.body || {});
        if (!bodyResult.success) {
            const firstIssue = bodyResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid request body',
            });
        }

        const { likeId } = paramsResult.data;
        const { replyMessage } = bodyResult.data;

        try {
            // Verify ownership
            const like = await likeService.getLike(likeId);
            if (!like) return reply.status(404).send({ error: 'Like not found' });
            if (like.likedId !== user.id) return reply.status(403).send({ error: 'Not authorized' });

            const match = await matchService.acceptLike(likeId, replyMessage);
            return reply.send(match);
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    app.post('/likes/:likeId/decline', async (request, reply) => {
        const user = request.user!;

        const paramsResult = likeIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
            const firstIssue = paramsResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid like ID',
            });
        }

        const { likeId } = paramsResult.data;

        try {
            const like = await likeService.getLike(likeId);
            if (!like) return reply.status(404).send({ error: 'Like not found' });
            if (like.likedId !== user.id) return reply.status(403).send({ error: 'Not authorized' });

            await likeService.archiveLike(likeId);
            return reply.send({ success: true });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    // Matches
    app.get('/matches', async (request, reply) => {
        const user = request.user!;
        const { limit, cursor } = request.query as { limit?: string; cursor?: string };
        const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
        try {
            const { data, nextCursor } = await matchService.getMatches(user.id, parsedLimit, cursor);
            return reply.send({ data, nextCursor });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch matches' });
        }
    });

    app.post('/matches/:matchId/unmatch', async (request, reply) => {
        // TODO [POST-MVP]: Add RESTful DELETE /api/matches/:matchId alias and deprecate this POST.
        const user = request.user!;

        const paramsResult = matchIdParamSchema.safeParse(request.params);
        if (!paramsResult.success) {
            const firstIssue = paramsResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid match ID',
            });
        }

        const { matchId } = paramsResult.data;

        try {
            await matchService.unmatch(matchId, user.id);
            return reply.send({ success: true });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    // Blocking
    app.post('/users/block', async (request, reply) => {
        const user = request.user!;

        const parseResult = blockUserSchema.safeParse(request.body);
        if (!parseResult.success) {
            const firstIssue = parseResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid request',
                field: firstIssue?.path.join('.') || 'unknown',
            });
        }

        const { userId: blockedId } = parseResult.data;

        try {
            await blockService.blockUser(user.id, blockedId);
            return reply.send({ success: true });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });
}
