/**
 * @file src/routes/profile.routes.ts
 * @description Authenticated profile read/update for the current user.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

const MAX_BIO_LENGTH = 300;
const MAX_SKILLS = 10;
const MAX_INTERESTS = 10;
const MAX_TAG_LENGTH = 30;

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  bio: z.string().max(MAX_BIO_LENGTH).optional(),
  skills: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_SKILLS).optional(),
  interests: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_INTERESTS).optional(),
  experience: z.string().max(200).optional(),
  commitment: z.string().max(100).optional(),
  githubUsername: z.string().max(100).optional(),
  locationSharing: z.string().max(20).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

const selectFields = {
  id: true,
  name: true,
  fullName: true,
  birthDate: true,
  gender: true,
  onboardingCompleted: true,
  profilePicture: true,
  bio: true,
  skills: true,
  interests: true,
  experience: true,
  commitment: true,
  githubUsername: true,
  location: true,
  city: true,
  country: true,
  locationSharing: true,
};

export default async function profileRoutes(app: FastifyInstance) {
  app.get('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  });

  app.patch('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const parse = updateProfileSchema.safeParse(request.body);
    if (!parse.success) {
      const first = parse.error.issues[0];
      return reply.status(400).send({ error: first?.message || 'Invalid payload' });
    }

    const data = parse.data;
    // Map fullName to name for compatibility
    if (data.fullName !== undefined) {
      (data as any).name = data.fullName;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: selectFields,
    });

    return reply.send(updated);
  });
}
