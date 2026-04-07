/**
 * @file tests/integration/routes/auth-routes.test.ts
 * @description Integration tests for authentication routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase } from '../../helpers.js';
import { rateLimiter } from '../../../src/rate-limiting/index.js';

describe('Auth Routes', () => {
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
        // Signup limiter window is 24h; reset test IP keys for deterministic runs.
        await rateLimiter.reset('signup:127.0.0.1');
        await rateLimiter.reset('signup:::1');
    });

    /**
     * Should reject signup with missing email
     */
    it('POST /auth/signup creates account with valid payload', async () => {
        const email = `signup${Date.now()}@mailinator.com`;

        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email,
                password: 'password123',
                name: 'John Doe',
            },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body).toEqual({ success: true });
    });

    /**
     * Should reject signup with missing email
     */
    it('POST /auth/signup rejects missing email', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                password: 'password123',
                name: 'John Doe',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Missing fields');
    });

    /**
     * Should reject signup with missing password
     */
    it('rejects missing password', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email: 'test@example.com',
                name: 'John Doe',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Missing fields');
    });

    /**
     * Should reject signup with missing name
     */
    it('rejects missing name', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email: 'test@example.com',
                password: 'password123',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Missing fields');
    });

    /**
     * Should reject reserved name 'admin'
     */
    it('rejects reserved name admin', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email: 'admin@example.com',
                password: 'password123',
                name: 'admin',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Invalid or reserved name');
    });

    /**
     * Should reject reserved name 'root'
     */
    it('rejects reserved name root', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email: 'root@example.com',
                password: 'password123',
                name: 'root',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Invalid or reserved name');
    });

    /**
     * Should reject name with numbers
     */
    it('rejects name with numbers', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: {
                email: 'test@example.com',
                password: 'password123',
                name: 'John123',
            },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Invalid or reserved name');
    });

    /**
     * Should return user info with valid token
     */
    it('GET /auth/me returns user info with valid token', async () => {
        const token = await getAuthToken('test-user-id', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('user');
        expect(body.user).toHaveProperty('appUserId');
        expect(body.user).toHaveProperty('email');
    });

    /**
     * Should reject GET /auth/me without auth
     */
    it('GET /auth/me rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/auth/me',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject GET /auth/me with invalid token
     */
    it('GET /auth/me rejects invalid token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: {
                authorization: 'Bearer invalid-token-12345',
            },
        });

        expect(response.statusCode).toBe(401);
    });
});
