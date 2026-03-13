/**
 * @file tests/unit/schemas/profile-schema.test.ts
 * @description Unit tests for profile update schema
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_GITHUB_MAX_LENGTH,
  PROFILE_MAX_PROJECTS,
  PROFILE_MAX_EXPERIENCES,
  PROFILE_PROJECT_NAME_MAX_LENGTH,
  PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH,
  PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH,
  PROFILE_EXPERIENCE_POSITION_MAX_LENGTH,
  PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH,
} from '../../../src/schemas/validation-constants.js';

const optionalDateSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.coerce.date().optional());

const projectInputSchema = z.object({
  name: z.string().min(1).max(PROFILE_PROJECT_NAME_MAX_LENGTH),
  description: z.string().min(1).max(PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH),
});

const experienceInputSchema = z.object({
  company: z.string().min(1).max(PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH),
  position: z.string().min(1).max(PROFILE_EXPERIENCE_POSITION_MAX_LENGTH),
  description: z.string().max(PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH).optional(),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
}).refine((val) => {
  if (!val.startDate || !val.endDate) return true;
  return val.endDate >= val.startDate;
}, {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

// Recreate the schema from profile.routes.ts since it's not exported.
const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(PROFILE_NAME_MAX_LENGTH).optional(),
  birthDate: z.coerce.date().optional(),
  bio: z.string().max(PROFILE_BIO_MAX_LENGTH).optional(),
  skills: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_SKILLS).optional(),
  interests: z.array(z.string().max(PROFILE_TAG_MAX_LENGTH)).max(PROFILE_MAX_INTERESTS).optional(),
  githubUsername: z.string().max(PROFILE_GITHUB_MAX_LENGTH).optional(),
  locationSharing: z.string().max(20).optional(),
  onboardingCompleted: z.boolean().optional(),
  projects: z.array(projectInputSchema).max(PROFILE_MAX_PROJECTS).optional(),
  experiences: z.array(experienceInputSchema).max(PROFILE_MAX_EXPERIENCES).optional(),
});

describe('updateProfileSchema', () => {
  it('accepts valid minimal update (just fullName)', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fullName (min 1)', () => {
    const result = updateProfileSchema.safeParse({
      fullName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects bio > 300 chars', () => {
    const result = updateProfileSchema.safeParse({
      bio: 'a'.repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it(`rejects > ${PROFILE_MAX_SKILLS} skills`, () => {
    const result = updateProfileSchema.safeParse({
      skills: Array(PROFILE_MAX_SKILLS + 1).fill('TypeScript'),
    });
    expect(result.success).toBe(false);
  });

  it('coerces birthDate string to Date', () => {
    const result = updateProfileSchema.safeParse({
      birthDate: '2000-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthDate).toBeInstanceOf(Date);
    }
  });

  it('accepts projects and experiences together', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Jane Doe',
      projects: [
        { name: 'Troupe', description: 'Mini portfolio and matching app' },
      ],
      experiences: [
        {
          company: 'Acme',
          position: 'Frontend Intern',
          description: 'Built React Native features',
          startDate: '2024-01',
          endDate: '2024-05',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty timeline strings as optional', () => {
    const result = updateProfileSchema.safeParse({
      experiences: [
        {
          company: 'Acme',
          position: 'Intern',
          startDate: '',
          endDate: '',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects > 5 projects', () => {
    const result = updateProfileSchema.safeParse({
      projects: Array(6).fill({ name: 'P', description: 'D' }),
    });
    expect(result.success).toBe(false);
  });

  it('rejects project description > 500 chars', () => {
    const result = updateProfileSchema.safeParse({
      projects: [{ name: 'P', description: 'a'.repeat(501) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects experience endDate before startDate', () => {
    const result = updateProfileSchema.safeParse({
      experiences: [
        {
          company: 'Acme',
          position: 'Intern',
          startDate: '2024-09',
          endDate: '2024-01',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
