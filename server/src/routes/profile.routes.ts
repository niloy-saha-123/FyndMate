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
const MIN_AGE = 13;

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  birthDate: z.coerce.date().optional(),
  bio: z.string().max(MAX_BIO_LENGTH).optional(),
  skills: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_SKILLS).optional(),
  interests: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_INTERESTS).optional(),
  experience: z.string().max(200).optional(),
  commitment: z.string().max(100).optional(),
  githubUsername: z.string().max(100).optional(),
  locationSharing: z.string().max(20).optional(),
  onboardingCompleted: z.boolean().optional(),
});

function computeAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age--;
  }
  return age;
}

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
    const age = user.birthDate ? computeAge(new Date(user.birthDate)) : null;
    return reply.send({ ...user, age });
  });

  app.patch('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const parse = updateProfileSchema.safeParse(request.body);
    if (!parse.success) {
      const first = parse.error.issues[0];
      return reply.status(400).send({ error: first?.message || 'Invalid payload' });
    }

    const data = parse.data;

    // Fetch current birthDate so partial updates (e.g., name) don't fail
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    const finalBirthDate = data.birthDate ?? current?.birthDate ?? null;

    // Birthdate must exist before onboarding completes; allow interim updates during onboarding
    if (!finalBirthDate) {
      if (data.onboardingCompleted) {
        return reply.status(400).send({ error: 'Birthdate is required before completing onboarding.' });
      }
      const updated = await prisma.user.update({
        where: { id: userId },
        data: data.fullName !== undefined ? { ...data, name: data.fullName } : data,
        select: selectFields,
      });
      return reply.send({ ...updated, age: null });
    }

    const age = computeAge(new Date(finalBirthDate));
    if (age < MIN_AGE) {
      return reply.status(400).send({ error: `You must be at least ${MIN_AGE} years old.` });
    }

    // Map fullName to name for compatibility
    const updateData: any = { ...data, birthDate: finalBirthDate };
    if (data.fullName !== undefined) {
      updateData.name = data.fullName;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: selectFields,
    });

    return reply.send({ ...updated, age });
  });
}
