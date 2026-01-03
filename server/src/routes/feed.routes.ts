import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { feedService } from '../services/feed.service.js';

export default async function feedRoutes(app: FastifyInstance) {
    // GET /api/feed
    app.get('/', {
        preHandler: [authMiddleware],
    }, async (request, reply) => {
        const user = request.user!;
        const { limit, cursor } = request.query as { limit?: string; cursor?: string };

        const parsedLimit = limit ? parseInt(limit, 10) : 20;

        try {
            const users = await feedService.getFeed(user.id, parsedLimit, cursor);
            return reply.send({ data: users });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch feed' });
        }
    });
}
