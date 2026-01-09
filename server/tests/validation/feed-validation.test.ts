/**
 * @file tests/validation/feed-validation.test.ts
 * @description Validation tests for the User Feed API route.
 *
 * This suite checks that:
 * - Pagination limits adhere to the minimum and maximum boundaries.
 * - The cursor is provided in the correct CUID format.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Feed Route Validation Suite.
 * Uses a test user to perform authenticated GET requests to the feed.
 */
describe('Feed Route Validation', () => {
    let app: FastifyInstance;
    let testUser: any;
    let authToken: string;

    /** Initialise Fastify application before all tests. */
    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    /** Reset database and create a fresh authenticated user before each test. */
    beforeEach(async () => {
        await clearDatabase();
        testUser = await createDummyUser('TestUser');
        authToken = await getAuthToken(testUser.supabaseId, testUser.email);
    });

    /** Close the Fastify instance after all tests have run. */
    afterAll(async () => {
        await app.close();
    });

    /**
     * Scenario: 'limit' parameter exceeds default maximum (50).
     * Expected: Request rejected (400 Bad Request) specifying valid range.
     */
    it('should reject limit greater than 50', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?limit=100',
            headers: { Authorization: `Bearer ${authToken}` },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Limit must be between 1 and 50');
    });

    /**
     * Scenario: 'limit' parameter is less than minimum (1).
     * Expected: Request rejected (400 Bad Request) specifying valid range.
     */
    it('should reject limit less than 1', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?limit=0',
            headers: { Authorization: `Bearer ${authToken}` },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Limit must be between 1 and 50');
    });

    /**
     * Scenario: 'cursor' parameter is not a valid CUID.
     * Expected: Request rejected (400 Bad Request) for format validation.
     */
    it('should reject invalid cursor format', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed?cursor=invalid-cursor',
            headers: { Authorization: `Bearer ${authToken}` },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Invalid cursor format');
    });
});
