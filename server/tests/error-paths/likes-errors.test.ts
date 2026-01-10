/**
 * @file tests/error-paths/likes-errors.test.ts
 * @description Service error handling tests for the LikeService.
 *
 * This suite verifies business logic constraints, such as preventing duplicate likes
 * or conflicting interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Like Service Error Paths Suite.
 * Sets up the full app environment to test service level rejections via API.
 */
describe('Like Service Error Paths', () => {
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
     * Duplicate Like Prevention
     * Scenario: User attempts to like the same person twice.
     * Expected: The second attempt is rejected (400 Bad Request) with a conflict message.
     */
    it('should prevent duplicate likes', async () => {
        const targetUser = await createDummyUser('TargetUser');
        // First like
        const firstResponse = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            payload: { likedId: targetUser.id, liked: true, message: 'First like message that meets the length requirement' },
        });
        expect(firstResponse.statusCode).toBe(200);

        // Attempt duplicate like
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            payload: { likedId: targetUser.id, liked: true, message: 'Duplicate like message that is long enough' },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('You have already liked this user.');
    });
});
