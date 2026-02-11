/**
 * @file tests/unit/schemas/profile-schema.test.ts
 * @description Unit tests for profile update schema
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Recreate the schema from profile.routes.ts since it's not exported
const updateProfileSchema = z.object({
    fullName: z.string().min(1).max(100).optional(),
    birthDate: z.coerce.date().optional(),
    bio: z.string().max(300).optional(),
    skills: z.array(z.string().max(30)).max(10).optional(),
    interests: z.array(z.string().max(30)).max(10).optional(),
    experience: z.string().max(200).optional(),
    commitment: z.string().max(100).optional(),
    githubUsername: z.string().max(100).optional(),
    locationSharing: z.string().max(20).optional(),
    onboardingCompleted: z.boolean().optional(),
});

describe('updateProfileSchema', () => {
    /**
     * Should accept valid minimal update with just fullName
     */
    it('accepts valid minimal update (just fullName)', () => {
        const result = updateProfileSchema.safeParse({
            fullName: 'John Doe',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject empty fullName (min 1)
     */
    it('rejects empty fullName (min 1)', () => {
        const result = updateProfileSchema.safeParse({
            fullName: '',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject bio > 300 chars
     */
    it('rejects bio > 300 chars', () => {
        const result = updateProfileSchema.safeParse({
            bio: 'a'.repeat(301),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject > 10 skills
     */
    it('rejects > 10 skills', () => {
        const result = updateProfileSchema.safeParse({
            skills: Array(11).fill('TypeScript'),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject skill tag > 30 chars
     */
    it('rejects skill tag > 30 chars', () => {
        const result = updateProfileSchema.safeParse({
            skills: ['a'.repeat(31)],
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should coerce date string to Date
     */
    it('coerces date string to Date', () => {
        const result = updateProfileSchema.safeParse({
            birthDate: '2000-01-01',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.birthDate).toBeInstanceOf(Date);
        }
    });

    /**
     * Should reject > 10 interests
     */
    it('rejects > 10 interests', () => {
        const result = updateProfileSchema.safeParse({
            interests: Array(11).fill('Coding'),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept all fields together
     */
    it('accepts all fields together', () => {
        const result = updateProfileSchema.safeParse({
            fullName: 'Jane Doe',
            birthDate: '1995-05-15',
            bio: 'Software engineer',
            skills: ['TypeScript', 'React'],
            interests: ['Open Source', 'AI'],
            experience: '5 years in web development',
            commitment: 'Part-time',
            githubUsername: 'janedoe',
            locationSharing: 'on',
            onboardingCompleted: true,
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject experience > 200 chars
     */
    it('rejects experience > 200 chars', () => {
        const result = updateProfileSchema.safeParse({
            experience: 'a'.repeat(201),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject commitment > 100 chars
     */
    it('rejects commitment > 100 chars', () => {
        const result = updateProfileSchema.safeParse({
            commitment: 'a'.repeat(101),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept onboardingCompleted boolean
     */
    it('accepts onboardingCompleted boolean', () => {
        const result = updateProfileSchema.safeParse({
            onboardingCompleted: true,
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept locationSharing string
     */
    it('accepts locationSharing string', () => {
        const result = updateProfileSchema.safeParse({
            locationSharing: 'always',
        });
        expect(result.success).toBe(true);
    });
});
