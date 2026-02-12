/**
 * @file tests/integration/routes/profile-routes.test.ts
 * @description Integration tests for profile routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Profile Routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
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
        expect(body).toHaveProperty('email');
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
     * Should reject > 10 skills
     */
    it('rejects > 10 skills', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                skills: Array(11).fill('TypeScript'),
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
                    { name: 'Fyndmate', description: 'A mini portfolio + collaborator app' },
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
        expect(body.projects[0].name).toBe('Fyndmate');
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
});
