/**
 * @file tests/integration/routes/profile-routes.test.ts
 * @description Integration tests for profile routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Profile Routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS public.deleted_account_retention (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id text NOT NULL,
            supabase_id text NOT NULL,
            email text,
            deleted_at timestamptz NOT NULL DEFAULT now(),
            retention_ends_at timestamptz NOT NULL,
            quarantined_file_paths text[] NOT NULL DEFAULT '{}'::text[],
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            purged_at timestamptz
          );
        `);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should return 200 with profile
     */
    it('GET /api/profile/me returns 200 with profile', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should include age field in response
     */
    it('includes age field in response', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        await prisma.user.update({
            where: { id: me!.id },
            data: { birthDate: new Date('2000-01-01') },
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('age');
    });

    /**
     * Should update fullName
     */
    it('PATCH updates fullName', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fullName: 'John Updated',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.name).toBe('John Updated');
    });

    /**
     * Should update bio
     */
    it('PATCH updates bio', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                bio: 'My new bio',
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject bio > 300 chars
     */
    it('rejects bio > 300 chars', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                bio: 'a'.repeat(301),
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject > 15 skills
     */
    it('rejects > 15 skills', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                skills: Array(16).fill('TypeScript'),
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should update skills array
     */
    it('updates skills array', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                skills: ['TypeScript', 'React', 'Node.js'],
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject PATCH without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            payload: {
                fullName: 'Test',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject onboardingCompleted without birthDate
     */
    it('rejects onboardingCompleted without birthDate', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                onboardingCompleted: true,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject age < 13
     */
    it('rejects age < 13', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const recentDate = new Date();
        recentDate.setFullYear(recentDate.getFullYear() - 10);

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                birthDate: recentDate.toISOString(),
                onboardingCompleted: true,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should coerce birthDate string to Date
     */
    it('coerces birthDate string to date', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                birthDate: '2000-01-01',
            },
        });

        expect(response.statusCode).toBe(200);
    });

    it('PATCH updates projects and experiences', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                projects: [
                    { name: 'Troupe', description: 'A mini portfolio + collaborator app' },
                ],
                experiences: [
                    {
                        company: 'Acme Labs',
                        position: 'Software Intern',
                        description: 'Built mobile features',
                        startDate: '2024-01',
                        endDate: '2024-05',
                    },
                ],
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(Array.isArray(body.projects)).toBe(true);
        expect(body.projects[0].name).toBe('Troupe');
        expect(Array.isArray(body.experiences)).toBe(true);
        expect(body.experiences[0].company).toBe('Acme Labs');
    });

    it('PATCH accepts optional empty experience timeline', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                experiences: [
                    {
                        company: 'Acme Labs',
                        position: 'Intern',
                        startDate: '',
                        endDate: '',
                    },
                ],
            },
        });

        expect(response.statusCode).toBe(200);
    });

    it('PATCH rejects > 5 projects', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                projects: Array(6).fill({
                    name: 'Project',
                    description: 'Description',
                }),
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it('GET /api/profile/:userId allows viewing incoming requester profile', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const receiver = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
        const requester = await createDummyUser('Requester');

        await prisma.like.create({
            data: {
                likerId: requester.id,
                likedId: receiver!.id,
                liked: true,
                message: 'Hello there!',
                status: 'active',
            },
        });

        const response = await app.inject({
            method: 'GET',
            url: `/api/profile/${requester.id}`,
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe(requester.id);
    });

    it('GET /api/profile/:userId rejects when no match and no incoming request', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const stranger = await createDummyUser('Stranger');

        const response = await app.inject({
            method: 'GET',
            url: `/api/profile/${stranger.id}`,
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    it('DELETE /api/profile/me deletes account', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        const response = await app.inject({
            method: 'DELETE',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ success: true });

        const deleted = await prisma.user.findUnique({ where: { id: me!.id } });
        expect(deleted).toBeNull();
    });

    it('DELETE /api/profile/me writes retention ledger row', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        const response = await app.inject({
            method: 'DELETE',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);

        const rows = await prisma.$queryRawUnsafe<Array<{
            user_id: string;
            supabase_id: string;
            email: string;
            retention_ends_at: Date;
        }>>(
            'SELECT user_id, supabase_id, email, retention_ends_at FROM public.deleted_account_retention WHERE user_id = $1',
            me!.id
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(me!.id);
        expect(rows[0].supabase_id).toBe(me!.supabaseId);
        expect(rows[0].email).toBe(me!.email);
        expect(new Date(rows[0].retention_ends_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('DELETE /api/profile/me rejects without auth', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/profile/me',
        });

        expect(response.statusCode).toBe(401);
    });
});
