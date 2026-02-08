/**
 * @file src/routes/notifications.routes.ts
 * @description Server-side push notification endpoints.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

const sendPushSchema = z.object({
  receiverUserId: z.string().min(1),
  message: z.string().min(1).max(200),
  title: z.string().max(100).optional(),
  matchId: z.string().optional(),
});

export default async function notificationRoutes(app: FastifyInstance) {
  app.post('/notifications/send', { preHandler: [authMiddleware] }, async (request, reply) => {
    const senderId = request.user!.id;
    const parse = sendPushSchema.safeParse(request.body);
    if (!parse.success) {
      const first = parse.error.issues[0];
      return reply.status(400).send({ error: first?.message || 'Invalid payload' });
    }

    const { receiverUserId, message, title, matchId } = parse.data;
    if (receiverUserId === senderId) {
      return reply.status(400).send({ error: 'Cannot notify self' });
    }

    // Allow only if sender and receiver are in an active match.
    let matchExists = false;
    if (matchId) {
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          status: 'active',
          OR: [
            { user1Id: senderId, user2Id: receiverUserId },
            { user1Id: receiverUserId, user2Id: senderId },
          ],
        },
        select: { id: true },
      });
      matchExists = !!match;
    } else {
      const match = await prisma.match.findFirst({
        where: {
          status: 'active',
          OR: [
            { user1Id: senderId, user2Id: receiverUserId },
            { user1Id: receiverUserId, user2Id: senderId },
          ],
        },
        select: { id: true },
      });
      matchExists = !!match;
    }

    if (!matchExists) {
      return reply.status(403).send({ error: 'Not authorized to notify this user' });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverUserId },
      select: { pushToken: true },
    });

    if (!receiver?.pushToken) {
      return reply.send({ success: false, reason: 'no_push_token' });
    }

    const payload = {
      to: receiver.pushToken,
      sound: 'default',
      title: title ?? 'New message',
      body: message,
      data: { type: 'message' },
      priority: 'high',
      channelId: 'default',
    };

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      return reply.send({ success: true, result });
    } catch (err: any) {
      request.log.error(err, 'Failed to send push notification');
      return reply.status(500).send({ error: 'Failed to send push' });
    }
  });
}
