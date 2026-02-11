/**
 * @file tests/integration/routes/feed-routes.test.ts
 * @description Integration tests for feed routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser } from '../../helpers.js';
import { assertNoSensitiveFields } from '../../test-utils/assertions.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Feed Routes', () => {
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
     * Should return 200 with data array
     */
    it('GET /api/feed returns 200 with data array', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        await createDummyUser('Other1');
        await createDummyUser('Other2');

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject invalid cursor (not UUID)
     */
    it('rejects invalid cursor (not UUID)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?cursor=not-a-uuid',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject limit > 50
     */
    it('rejects limit > 50', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?limit=51',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject limit < 1
     */
    it('rejects limit < 1', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?limit=0',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should not expose sensitive location fields
     */
    it('does not expose sensitive location fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        await createDummyUser('Other', {
            latitude: 40.7128,
            longitude: -74.006,
            locationSecret: 'secret123',
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        if (body.data.length > 0) {
            assertNoSensitiveFields(body.data[0]);
        }
    });

    /**
     * Should wrap response in { data: [...] }
     */
    it('wraps response in { data: [...] }', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
    });
});
