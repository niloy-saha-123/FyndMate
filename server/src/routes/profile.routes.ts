/**
 * @file src/routes/profile.routes.ts
 * @description Authenticated profile read/update for the current user.
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { signProfilePicture } from '../utils/profilePicture.js';
import { computeAge } from '../utils/computeAge.js';
import { sanitizeText } from '../utils/sanitizeText.js';
import { filterLocationByPrivacy } from '../utils/locationPrivacy.js';
import { moveStoragePathToQuarantine, moveUserFilesToQuarantine, toStoragePath } from '../services/storage.service.js';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_GITHUB_MAX_LENGTH,
  PROFILE_MIN_AGE,
  PROFILE_MAX_PROJECTS,
  PROFILE_MAX_EXPERIENCES,
  PROFILE_PROJECT_NAME_MAX_LENGTH,
  PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH,
  PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH,
  PROFILE_EXPERIENCE_POSITION_MAX_LENGTH,
  PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH,
} from '../schemas/validation-constants.js';

const GITHUB_USERNAME_REGEX = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
const EXPERIENCE_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const TAG_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} +#./&-]*$/u;
const ACCOUNT_DELETION_RETENTION_DAYS = Math.max(
  1,
  Number(process.env.ACCOUNT_DELETION_RETENTION_DAYS ?? 14)
);

const projectInputSchema = z.object({
  name: z.string().min(1).max(PROFILE_PROJECT_NAME_MAX_LENGTH),
  description: z.string().min(1).max(PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH),
});

const optionalDateSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.coerce.date().optional());

const optionalExperienceDateInputSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}, z.string().regex(EXPERIENCE_DATE_REGEX, 'Date must use YYYY-MM format').optional());

const experienceInputSchema = z.object({
  company: z.string().min(1).max(PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH),
  position: z.string().min(1).max(PROFILE_EXPERIENCE_POSITION_MAX_LENGTH),
  description: z.string().max(PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH).optional(),
  startDate: optionalExperienceDateInputSchema,
  endDate: optionalExperienceDateInputSchema,
}).refine((val) => {
  if (!val.endDate) return true;
  return Boolean(val.startDate);
}, {
  message: 'endDate requires startDate',
  path: ['endDate'],
}).refine((val) => {
  if (!val.startDate || !val.endDate) return true;
  const start = new Date(`${val.startDate}-01`);
  const end = new Date(`${val.endDate}-01`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end >= start;
}, {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(PROFILE_NAME_MAX_LENGTH).optional(),
  birthDate: z.coerce.date().optional(),
  bio: z.string().max(PROFILE_BIO_MAX_LENGTH).optional(),
  skills: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_SKILLS).optional(),
  interests: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_INTERESTS).optional(),
  githubUsername: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return String(value).trim();
  }, z.string()
    .max(PROFILE_GITHUB_MAX_LENGTH)
    .regex(GITHUB_USERNAME_REGEX, 'Invalid GitHub username format')
    .optional()),
  locationSharing: z.string().max(20).optional(),
  onboardingCompleted: z.boolean().optional(),
  projects: z.array(projectInputSchema).max(PROFILE_MAX_PROJECTS).optional(),
  experiences: z.array(experienceInputSchema).max(PROFILE_MAX_EXPERIENCES).optional(),
});

function normalizeExperienceDateOrThrow(raw: string | undefined, field: 'startDate' | 'endDate', index: number): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!EXPERIENCE_DATE_REGEX.test(trimmed)) {
    throw new Error(`experiences.${index}.${field}: Date must use YYYY-MM format`);
  }
  const parsed = new Date(`${trimmed}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`experiences.${index}.${field}: Invalid date`);
  }
  return parsed;
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
  githubUsername: true,
  location: true,
  city: true,
  country: true,
  locationSharing: true,
  locationPermission: true,
  projects: {
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: PROFILE_MAX_PROJECTS,
  },
  experiences: {
    select: {
      id: true,
      company: true,
      position: true,
      description: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: PROFILE_MAX_EXPERIENCES,
  },
};

function serializeProfile(user: any, profilePicture: string | null, age: number | null) {
  return {
    ...user,
    profilePicture,
    age,
    projects: (user.projects ?? []).map((project: any) => ({
      id: project.id,
      name: project.title,
      description: project.description,
    })),
    experiences: (user.experiences ?? []).map((exp: any) => ({
      id: exp.id,
      company: exp.company,
      position: exp.position,
      description: exp.description,
      startDate: exp.startDate,
      endDate: exp.endDate,
    })),
  };
}

function serializePublicProfile(user: any, profilePicture: string | null, age: number | null) {
  const visible = filterLocationByPrivacy(user);
  return {
    id: visible.id,
    name: visible.name,
    profilePicture,
    bio: visible.bio ?? null,
    skills: visible.skills ?? [],
    interests: visible.interests ?? [],
    lookingFor: visible.interests ?? [],
    age,
    city: visible.city ?? null,
    country: visible.country ?? null,
    gender: visible.gender ?? null,
    githubUsername: visible.githubUsername ?? null,
    projects: (visible.projects ?? []).map((project: any) => ({
      id: project.id,
      name: project.title,
      description: project.description,
    })),
    experiences: (visible.experiences ?? []).map((exp: any) => ({
      id: exp.id,
      company: exp.company,
      position: exp.position,
      description: exp.description,
      startDate: exp.startDate,
      endDate: exp.endDate,
    })),
  };
}

export default async function profileRoutes(app: FastifyInstance) {
  app.get('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const age = user.birthDate ? computeAge(new Date(user.birthDate)) : null;
    const profilePicture = await signProfilePicture(user.profilePicture);
    return reply.send(serializeProfile(user, profilePicture, age));
  });

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

    // Fetch current birthDate so partial updates don't fail age/onboarding checks.
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    const finalBirthDate = data.birthDate ?? current?.birthDate ?? null;
    if (!finalBirthDate) {
      if (data.onboardingCompleted) {
        return reply.status(400).send({ error: 'Birthdate is required before completing onboarding.' });
      }
    } else {
      const age = computeAge(new Date(finalBirthDate));
      if (age !== null && age < PROFILE_MIN_AGE) {
        return reply.status(400).send({ error: `You must be at least ${PROFILE_MIN_AGE} years old.` });
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const { projects, experiences, fullName, ...rest } = data;
        const sanitizedProjects = projects?.map((project, idx) => {
          const name = sanitizeText(project.name);
          const description = sanitizeText(project.description);
          if (!name || !description) {
            throw new Error(`projects.${idx}: name and description are required`);
          }
          return { title: name, description, techStack: [] as string[] };
        });

        const sanitizedExperiences = experiences?.map((experience, idx) => {
          const company = sanitizeText(experience.company);
          const position = sanitizeText(experience.position);
          const description = experience.description ? sanitizeText(experience.description) : null;
          if (!company || !position) {
            throw new Error(`experiences.${idx}: company and position are required`);
          }

          const startDate = normalizeExperienceDateOrThrow(experience.startDate, 'startDate', idx);
          const endDate = normalizeExperienceDateOrThrow(experience.endDate, 'endDate', idx);
          if (!startDate && endDate) {
            throw new Error(`experiences.${idx}.endDate: endDate requires startDate`);
          }
          const now = new Date();
          const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          if (startDate && startDate > currentMonth) {
            throw new Error(`experiences.${idx}.startDate: startDate cannot be in the future`);
          }
          if (endDate && endDate > currentMonth) {
            throw new Error(`experiences.${idx}.endDate: endDate cannot be in the future`);
          }
          if (startDate && endDate && endDate < startDate) {
            throw new Error(`experiences.${idx}.endDate: endDate must be after startDate`);
          }

          return {
            company,
            position,
            description: description || null,
            startDate,
            endDate,
          };
        });

        const sanitizedFullName = fullName !== undefined ? sanitizeText(fullName) : undefined;
        if (fullName !== undefined && !sanitizedFullName) {
          throw new Error('fullName is required');
        }

        const sanitizedBio = rest.bio !== undefined ? sanitizeText(rest.bio) : undefined;
        const sanitizedGithubUsername = rest.githubUsername !== undefined
          ? sanitizeText(rest.githubUsername)
          : undefined;
        const sanitizedSkills = rest.skills?.map((skill, idx) => {
          const sanitized = sanitizeText(skill).replace(/\s+/g, ' ').trim();
          if (!sanitized) {
            throw new Error(`skills.${idx}: value is required`);
          }
          if (sanitized.length > PROFILE_TAG_MAX_LENGTH) {
            throw new Error(`skills.${idx}: must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
          }
          if (!TAG_REGEX.test(sanitized)) {
            throw new Error(`skills.${idx}: contains invalid characters`);
          }
          return sanitized;
        });
        const sanitizedInterests = rest.interests?.map((interest, idx) => {
          const sanitized = sanitizeText(interest).replace(/\s+/g, ' ').trim();
          if (!sanitized) {
            throw new Error(`interests.${idx}: value is required`);
          }
          if (sanitized.length > PROFILE_TAG_MAX_LENGTH) {
            throw new Error(`interests.${idx}: must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
          }
          if (!TAG_REGEX.test(sanitized)) {
            throw new Error(`interests.${idx}: contains invalid characters`);
          }
          return sanitized;
        });

        const updateData: any = {
          ...rest,
          ...(sanitizedBio !== undefined ? { bio: sanitizedBio } : {}),
          ...(sanitizedGithubUsername !== undefined ? { githubUsername: sanitizedGithubUsername || null } : {}),
          ...(sanitizedSkills !== undefined ? { skills: sanitizedSkills } : {}),
          ...(sanitizedInterests !== undefined ? { interests: sanitizedInterests } : {}),
          ...(finalBirthDate ? { birthDate: finalBirthDate } : {}),
        };

        if (sanitizedFullName !== undefined) {
          updateData.name = sanitizedFullName;
          updateData.fullName = sanitizedFullName;
        }

        await tx.user.update({
          where: { id: userId },
          data: updateData,
          select: { id: true },
        });

        if (sanitizedProjects) {
          await tx.project.deleteMany({ where: { userId } });
          if (sanitizedProjects.length > 0) {
            await tx.project.createMany({
              data: sanitizedProjects.map((project) => ({ ...project, userId })),
            });
          }
        }

        if (sanitizedExperiences) {
          await tx.experience.deleteMany({ where: { userId } });
          if (sanitizedExperiences.length > 0) {
            await tx.experience.createMany({
              data: sanitizedExperiences.map((experience) => ({ ...experience, userId })),
            });
          }
        }

        return tx.user.findUnique({
          where: { id: userId },
          select: selectFields,
        });
      });

      if (!updated) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const age = updated.birthDate ? computeAge(new Date(updated.birthDate)) : null;
      const profilePicture = await signProfilePicture(updated.profilePicture);
      return reply.send(serializeProfile(updated, profilePicture, age));
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Invalid payload',
      });
    }
  });

  app.get('/profile/:userId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const requesterId = request.user!.id;
    const userId = (request.params as { userId?: string }).userId;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    if (userId !== requesterId) {
      const hasConnection = await prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: requesterId, user2Id: userId },
            { user1Id: userId, user2Id: requesterId },
          ],
          status: { in: ['active', 'blocked'] },
        },
        select: { id: true },
      });

      if (!hasConnection) {
        return reply.status(403).send({ error: 'Not authorized to view this profile' });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const age = user.birthDate ? computeAge(new Date(user.birthDate)) : null;
    const profilePicture = await signProfilePicture(user.profilePicture);
    return reply.send(serializePublicProfile(user, profilePicture, age));
  });

  app.delete('/profile/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const authUser = request.user!;

    try {
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          profilePicture: true,
          createdAt: true,
          locationSharing: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const retentionEndsAt = new Date(Date.now() + ACCOUNT_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const deletionReference = `${user.id}-${Date.now()}-${randomUUID()}`;
      const quarantinedPaths = new Set<string>();
      const quarantineFailures: string[] = [];

      const folderMoveResult = await moveUserFilesToQuarantine(user.id, deletionReference);
      for (const moved of folderMoveResult.moved) {
        quarantinedPaths.add(moved.quarantinePath);
      }
      for (const failure of folderMoveResult.failed) {
        quarantineFailures.push(`${failure.sourcePath}: ${failure.reason}`);
      }

      if (user.profilePicture) {
        const profilePicturePath = toStoragePath(user.profilePicture);
        const wasAlreadyMoved = folderMoveResult.moved.some(
          (moved) => moved.sourcePath === profilePicturePath
        );
        if (!wasAlreadyMoved) {
          const profilePictureMoveResult = await moveStoragePathToQuarantine(
            profilePicturePath,
            deletionReference
          );
          for (const moved of profilePictureMoveResult.moved) {
            quarantinedPaths.add(moved.quarantinePath);
          }
          for (const failure of profilePictureMoveResult.failed) {
            quarantineFailures.push(`${failure.sourcePath}: ${failure.reason}`);
          }
        }
      }

      // Delete Auth user first so they cannot be recreated by middleware on next token verification.
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.supabaseId);
      if (authDeleteError) {
        request.log.error({ authDeleteError, supabaseId: user.supabaseId }, 'Failed deleting auth user');
        return reply.status(500).send({ error: 'Failed to delete account. Please try again.' });
      }

      // Delete app user row (DB cascades remove dependent rows: matches, messages, likes, projects, etc).
      await prisma.user.deleteMany({
        where: { id: user.id },
      });

      // Best-effort retention log. Safe to proceed even if the retention table is missing.
      try {
        await prisma.$executeRawUnsafe(
          `
            INSERT INTO public.deleted_account_retention
            (
              user_id,
              supabase_id,
              email,
              deleted_at,
              retention_ends_at,
              quarantined_file_paths,
              metadata
            )
            VALUES ($1, $2, $3, NOW(), $4, $5, $6::jsonb)
          `,
          user.id,
          user.supabaseId,
          user.email,
          retentionEndsAt,
          Array.from(quarantinedPaths),
          JSON.stringify({
            deletedBy: 'self',
            quarantineFailures,
            locationSharing: user.locationSharing ?? null,
            accountCreatedAt: user.createdAt,
          })
        );
      } catch (retentionError: any) {
        request.log.warn(
          { retentionError, userId: user.id },
          'Delete account: failed to write deleted_account_retention audit row'
        );
      }

      return reply.send({ success: true });
    } catch (error: any) {
      request.log.error(error, 'Delete account failed');
      return reply.status(500).send({ error: 'Failed to delete account. Please try again.' });
    }
  });
}
