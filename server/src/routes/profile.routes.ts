/**
 * @file src/routes/profile.routes.ts
 * @description Authenticated profile read/update for the current user.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { signProfilePicture } from '../utils/profilePicture.js';
import { computeAge } from '../utils/computeAge.js';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_GITHUB_MAX_LENGTH,
  PROFILE_MIN_AGE,
} from '../schemas/validation-constants.js';

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(PROFILE_NAME_MAX_LENGTH).optional(),
  birthDate: z.coerce.date().optional(),
  bio: z.string().max(PROFILE_BIO_MAX_LENGTH).optional(),
  skills: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_SKILLS).optional(),
  interests: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_INTERESTS).optional(),
  experience: z.string().max(200).optional(),
  commitment: z.string().max(PROFILE_GITHUB_MAX_LENGTH).optional(),
  githubUsername: z.string().max(PROFILE_GITHUB_MAX_LENGTH).optional(),
  locationSharing: z.string().max(20).optional(),
  onboardingCompleted: z.boolean().optional(),
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

const publicProfileSelect = {
  id: true,
  name: true,
  profilePicture: true,
  bio: true,
  skills: true,
  interests: true,
  experience: true,
  commitment: true,
  birthDate: true,
  gender: true,
  city: true,
  country: true,
  githubUsername: true,
  lookingFor: true,
};

export default async function profileRoutes(app: FastifyInstance) {
  // Get current user's profile
  app.get('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const age = user.birthDate ? computeAge(new Date(user.birthDate)) : null;
    const profilePicture = await signProfilePicture(user.profilePicture);
    return reply.send({ ...user, profilePicture, age });
  });

  // Get another user's public profile
  app.get('/users/:userId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const paramsSchema = z.object({
      userId: z.string().uuid(),
    });
    
    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }
    
    const { userId } = paramsResult.data;
    const requestingUserId = request.user!.id;
    
    // Verify the users have a match/connection
    const matchExists = await prisma.match.findFirst({
      where: {
        AND: [
          { status: 'active' },
          {
            OR: [
              { user1Id: requestingUserId, user2Id: userId },
              { user1Id: userId, user2Id: requestingUserId }
            ]
          }
        ]
      }
    });
    
    if (!matchExists) {
      return reply.status(403).send({ error: 'Not authorized to view this profile' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicProfileSelect,
    });
    
    if (!user) return reply.status(404).send({ error: 'User not found' });
    
    const age = user.birthDate ? computeAge(new Date(user.birthDate)) : null;
    const profilePicture = await signProfilePicture(user.profilePicture);
    
    return reply.send({ ...user, profilePicture, age });
  });

  // Update current user's profile
  app.patch('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const parse = updateProfileSchema.safeParse(request.body);
    if (!parse.success) {
      const first = parse.error.issues[0];
      return reply.status(400).send({
        error: first?.message || 'Invalid payload',
        message: first?.message || 'Invalid payload',
        field: first?.path?.join('.') || 'unknown',
      });
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
    if (age !== null && age < PROFILE_MIN_AGE) {
      return reply.status(400).send({ error: `You must be at least ${PROFILE_MIN_AGE} years old.` });
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

    const profilePicture = await signProfilePicture(updated.profilePicture);

    return reply.send({ ...updated, profilePicture, age });
  });
}
