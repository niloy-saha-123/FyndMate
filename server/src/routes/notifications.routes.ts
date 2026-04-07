/**
 * @file src/routes/notifications.routes.ts
 * @description Server-side push notification endpoints.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { prisma } from '../lib/prisma.js';

const sendPushSchema = z.object({
  receiverUserId: z.string().min(1),
  message: z.string().min(1).max(200),
  title: z.string().max(100).optional(),
  matchId: z.string().optional(),
});

export default async function notificationRoutes(app: FastifyInstance) {
  const enableDirectPushApi =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DIRECT_PUSH_API === '1';

  if (enableDirectPushApi) {
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
        sound: 'default' as const,
        title: title ?? 'New message',
        body: message,
        data: { type: 'message', ...(matchId ? { matchId } : {}) },
        priority: 'high' as const,
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

  // PATCH /api/notifications/push-token - Save push token for current user
  const pushTokenSchema = z.object({
    pushToken: z.string().min(1, 'Push token is required').max(500, 'Token too long'),
  });

  app.patch(
    '/notifications/push-token',
    {
      preHandler: [
        authMiddleware,
        rateLimit({ limit: 5, windowSec: 3600, keyPrefix: 'push_token' }),
      ],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const parse = pushTokenSchema.safeParse(request.body);
      if (!parse.success) {
        const first = parse.error.issues[0];
        return reply.status(400).send({ error: first?.message || 'Invalid payload' });
      }

      const { pushToken } = parse.data;

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            pushToken,
            pushTokenUpdatedAt: new Date(),
          },
        });
        return reply.send({ success: true });
      } catch (err: any) {
        request.log.error(err, 'Failed to save push token');
        return reply.status(500).send({ error: 'Failed to save push token' });
      }
    }
  );

  // DELETE /api/notifications/push-token - Disable push notifications for current user
  app.delete(
    '/notifications/push-token',
    {
      preHandler: [
        authMiddleware,
        rateLimit({ limit: 5, windowSec: 3600, keyPrefix: 'push_token' }),
      ],
    },
    async (request, reply) => {
      const userId = request.user!.id;

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            pushToken: null,
            pushTokenUpdatedAt: new Date(),
          },
        });
        return reply.send({ success: true });
      } catch (err: any) {
        request.log.error(err, 'Failed to clear push token');
        return reply.status(500).send({ error: 'Failed to clear push token' });
      }
    }
  );

  // GET /api/notifications/preferences/:matchId - Get notification preference for a match
  app.get(
    '/notifications/preferences/:matchId',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const matchId = (request.params as { matchId?: string }).matchId;

      if (!matchId) {
        return reply.status(400).send({ error: 'Match ID is required' });
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { user1Id: true, user2Id: true },
      });

      if (
        !match ||
        (match.user1Id !== userId && match.user2Id !== userId)
      ) {
        return reply.status(403).send({ error: 'Not authorized' });
      }

      const pref = await prisma.matchNotificationPreference.findUnique({
        where: {
          matchId_userId: { matchId, userId },
        },
        select: { enabled: true },
      });

      return reply.send({ enabled: pref?.enabled ?? true });
    }
  );

  // PUT /api/notifications/preferences/:matchId - Set notification preference
  const preferenceSchema = z.object({
    enabled: z.boolean(),
  });

  app.put(
    '/notifications/preferences/:matchId',
    {
      preHandler: [authMiddleware],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const matchId = (request.params as { matchId?: string }).matchId;

      if (!matchId) {
        return reply.status(400).send({ error: 'Match ID is required' });
      }

      const parse = preferenceSchema.safeParse(request.body);
      if (!parse.success) {
        const first = parse.error.issues[0];
        return reply.status(400).send({ error: first?.message || 'Invalid payload' });
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { user1Id: true, user2Id: true },
      });

      if (
        !match ||
        (match.user1Id !== userId && match.user2Id !== userId)
      ) {
        return reply.status(403).send({ error: 'Not authorized' });
      }

      const { enabled } = parse.data;

      try {
        await prisma.matchNotificationPreference.upsert({
          where: {
            matchId_userId: { matchId, userId },
          },
          create: { matchId, userId, enabled },
          update: { enabled, updatedAt: new Date() },
        });
        return reply.send({ success: true, enabled });
      } catch (err: any) {
        request.log.error(err, 'Failed to update notification preference');
        return reply.status(500).send({ error: 'Failed to update preference' });
      }
    }
  );
}
