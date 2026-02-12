/**
 * @file src/utils/publicUser.ts
 * @description Centralized safe user projections for API responses.
 * 
 * RULE:
 * - Never include raw latitude/longitude/locationSecret in any public response.
 * - Use these selects in services/routes that return user data to clients.
 */

import { Prisma } from '@prisma/client';

export const publicUserFeedSelect = {
  id: true,
  name: true,
  profilePicture: true,
  bio: true,
  skills: true,
  interests: true,
  city: true,
  country: true,
  locationSharing: true,
  githubUsername: true,
  gender: true,
  projects: {
    select: {
      id: true,
      title: true,
      description: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  },
  experiences: {
    select: {
      id: true,
      company: true,
      position: true,
      description: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  },
} as const;

// Minimal fields for likes inbox preview
export const publicUserLikeSelect = {
  id: true,
  name: true,
  profilePicture: true,
} as const;

export const publicUserMatchSelect = {
  id: true,
  name: true,
  profilePicture: true,
} as const;

export type PublicFeedUser = Prisma.UserGetPayload<{
  select: typeof publicUserFeedSelect;
}>;

export type PublicLikeUser = Prisma.UserGetPayload<{
  select: typeof publicUserLikeSelect;
}>;

export type PublicMatchUser = Prisma.UserGetPayload<{
  select: typeof publicUserMatchSelect;
}>;
