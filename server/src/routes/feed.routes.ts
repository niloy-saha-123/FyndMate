/**
 * @file src/routes/feed.routes.ts
 * @description API endpoint for fetching the user discovery feed.
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { feedService } from '../services/feed.service.js';
import { feedQuerySchema } from '../schemas/matching.schema.js';

export default async function feedRoutes(app: FastifyInstance) {
    // GET /api/feed
    app.get('/', {
        preHandler: [
            authMiddleware,
            rateLimit({ limit: 60, windowSec: 60, keyPrefix: 'feed_req' })
        ],
    }, async (request, reply) => {
        const user = request.user!;

        // Validate query params
        const parseResult = feedQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            const firstIssue = parseResult.error.issues[0];
            return reply.status(400).send({
                error: 'Validation failed',
                message: firstIssue?.message || 'Invalid query parameters',
                field: firstIssue?.path.join('.') || 'unknown',
            });
        }

        const { limit, cursor } = parseResult.data;

        try {
            const users = await feedService.getFeed(user.id, limit, cursor);
            return reply.send({ data: users });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch feed' });
        }
    });
}
