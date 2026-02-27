/**
 * @file tests/integration/middleware/auth-middleware.test.ts
 * @description Integration tests for authentication middleware
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Auth Middleware', () => {
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
     * Should reject without Authorization header
     */
    it('rejects without Authorization header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject POST without auth
     */
    it('rejects POST without auth', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            payload: {
                likedId: crypto.randomUUID(),
                liked: true,
                message: 'Hello there!',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject wrong scheme
     */
    it('rejects wrong scheme NotBearer xyz', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: 'NotBearer xyz',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject without Bearer prefix
     */
    it('rejects without Bearer prefix', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: 'some-token',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject empty Authorization header
     */
    it('rejects empty Authorization header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: '',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject expired/invalid JWT
     */
    it('rejects expired/invalid JWT', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: 'Bearer invalid-jwt-token-12345',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should accept valid JWT and attach user
     */
    it('accepts valid JWT and attaches user', async () => {
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
    });

    /**
     * Should auto-create user on first request
     */
    it('auto-creates user on first request', async () => {
        const token = await getAuthToken('new-user', 'new@example.com');

        const usersBefore = await prisma.user.count();

        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);

        const usersAfter = await prisma.user.count();
        expect(usersAfter).toBeGreaterThan(usersBefore);
    });

    /**
     * Should return 403 for banned users
     */
    it('returns 403 for banned users', async () => {
        const banned = await createDummyUser('Banned', { banned: true });
        const token = await getAuthToken(banned.supabaseId, banned.email);

        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should handle missing Bearer prefix gracefully
     */
    it('handles missing Bearer prefix gracefully', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: 'just-a-token',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should set request.user with correct fields
     */
    it('sets request.user with correct fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('email');
        expect(body).toHaveProperty('supabaseId');
    });
});
