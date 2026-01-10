/**
 * @file tests/validation/match-validation.test.ts
 * @description Validation tests for Match-related API routes.
 * 
 * Verifies that route parameters (like matchId) are correctly validated
 * before processing requests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Match Route Validation Suite.
 * Sets up the app and an authenticated user for testing route validation.
 */
describe('Match Route Validation', () => {
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
     * Scenario: 'matchId' parameter provided in an invalid format.
     * Expected: Request rejected (400 Bad Request) with format validation error.
     */
    it('should reject invalid matchId format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/matches/invalid-id/unmatch',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            payload: {},
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Invalid match ID format');
    });
});
