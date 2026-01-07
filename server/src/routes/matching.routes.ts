/**
 * @file src/routes/matching.routes.ts
 * @description API Endpoints for all User Interactions (Likes, Matches, Blocks).
 * 
 * ENDPOINTS:
 * 1. LIKES
 *    - POST /api/likes: Send a Like (Swipe Right) or Pass (Swipe Left).
 *    - GET /api/likes/received: Get the "Likes You" Section.
 *    - POST /api/likes/:id/accept: Match with someone who liked you.
 *    - POST /api/likes/:id/decline: Remove someone from your likes list.
 * 
 * 2. MATCHES
 *    - GET /api/matches: Get your active chat list.
 *    - POST /api/matches/:id/unmatch: Break a match.
 * 
 * 3. SAFETY
 *    - POST /api/users/block: Block a user you have interacted with.
 */
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { likeService } from '../services/like.service.js';
import { matchService } from '../services/match.service.js';
import { blockService } from '../services/block.service.js';

export default async function matchingRoutes(app: FastifyInstance) {
    // Shared Auth Middleware
    app.addHook('preHandler', authMiddleware);

    // ============================================
    // LIKES
    // ============================================

    // POST /api/likes (Create Like/Pass)
    app.post('/likes', async (request, reply) => {
        const user = request.user!;
        const { likedId, liked, message } = request.body as { likedId: string; liked: boolean; message?: string };

        if (!likedId) return reply.status(400).send({ error: 'likedId is required' });
        if (typeof liked !== 'boolean') return reply.status(400).send({ error: 'liked must be boolean' });

        try {
            const result = await likeService.createLike(user.id, likedId, liked, message);
            return reply.send(result);
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    // GET /api/likes/received (The "Likes Section")
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

    // POST /api/likes/:likeId/accept
    app.post('/likes/:likeId/accept', async (request, reply) => {
        const user = request.user!;
        const { likeId } = request.params as { likeId: string };
        const { replyMessage } = request.body as { replyMessage?: string } || {};

        try {
            // Verify ownership (security check) - The Like must be FOR me
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

    // POST /api/likes/:likeId/decline
    app.post('/likes/:likeId/decline', async (request, reply) => {
        const user = request.user!;
        const { likeId } = request.params as { likeId: string };

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

    // ============================================
    // MATCHES
    // ============================================

    // GET /api/matches
    app.get('/matches', async (request, reply) => {
        const user = request.user!;
        try {
            const matches = await matchService.getMatches(user.id);
            return reply.send({ data: matches });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch matches' });
        }
    });

    // POST /api/matches/:matchId/unmatch
    app.post('/matches/:matchId/unmatch', async (request, reply) => {
        const user = request.user!;
        const { matchId } = request.params as { matchId: string };

        try {
            await matchService.unmatch(matchId, user.id);
            return reply.send({ success: true });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });

    // ============================================
    // BLOCKING
    // ============================================

    // POST /api/users/block
    app.post('/users/block', async (request, reply) => {
        const user = request.user!;
        const { userId: blockedId } = request.body as { userId: string };

        if (!blockedId) return reply.status(400).send({ error: 'userId is required' });

        try {
            await blockService.blockUser(user.id, blockedId);
            return reply.send({ success: true });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(400).send({ error: error.message });
        }
    });
}
