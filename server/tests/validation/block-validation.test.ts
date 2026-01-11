/**
 * @file tests/validation/block-validation.test.ts
 * @description Validation tests for the Block User API route.
 *
 * This test suite verifies that invalid input (malformed or missing user IDs)
 * is rejected by the validation layer before reaching the business logic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Block Route Validation Suite.
 * Sets up Fastify app and a test user, then tests input validation scenarios.
 */
describe('Block Route Validation', () => {
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
     * Scenario: User ID field contains an invalid format (non-CUID).
     * Expected: Validation failure (400 Bad Request) with appropriate error message.
     */
    it('should reject invalid userId format when blocking', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            payload: { userId: 'invalid-id' },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Invalid user ID format');
    });

    /**
     * Scenario: User ID field is missing from the payload.
     * Expected: Validation failure (400 Bad Request) indicating User ID is required.
     */
    it('should reject missing userId when blocking', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/users/block',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            payload: {},
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toMatch(/Invalid input|Required/i);
    });
});
