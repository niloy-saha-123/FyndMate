/**
 * @file tests/validation/likes-validation.test.ts
 * @description Validation tests for the Likes API routes.
 *
 * Each test case includes a descriptive comment explaining the scenario,
 * the expected behavior, and the validation rule being exercised.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import cuid from 'cuid';
import type { FastifyInstance } from 'fastify';

/**
 * Likes Route Validation Suite
 *
 * Covers validation of the POST /api/likes endpoint and the
 * POST /api/likes/:likeId/accept endpoint.
 */
describe('Likes Route Validation', () => {
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

    /** POST /api/likes – Create Like Validation */
    describe('POST /api/likes', () => {
        /** Scenario: likedId does not match CUID format. Expected: 400 response with error. */
        it('should reject invalid CUID format for likedId', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: 'invalid-id-format',
                    liked: true,
                    message: 'This message is long enough to pass validation requirements',
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation failed');
            expect(body.message).toContain('Invalid user ID format');
        });

        /** Scenario: liked field is a string instead of boolean. Expected: 400 response. */
        it('should reject non-boolean liked field', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: testUser.id,
                    liked: 'yes', // ❌ String instead of boolean
                    message: 'This message is long enough for validation',
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Validation failed');
        });

        /** Scenario: liked is true but message is omitted. Expected: 400 response. */
        it('should reject missing message when liked=true', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: cuid(),
                    liked: true,
                    // message missing but required when liked=true
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Message is required when liking someone');
        });

        /** Scenario: Message shorter than 20 characters. Expected: 400 response. */
        it('should reject message shorter than 20 characters', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: cuid(),
                    liked: true,
                    message: 'Too short!',
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Message must be at least 20 characters');
        });

        /** Scenario: Message exceeds 500 characters. Expected: 400 response. */
        it('should reject message longer than 500 characters', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: cuid(),
                    liked: true,
                    message: 'a'.repeat(501),
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Message cannot exceed 500 characters');
        });

        /** Scenario: All fields valid. Expected: Like created successfully (200). */
        it('should accept valid like with proper message', async () => {
            const targetUser = await createDummyUser('TargetUser');
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    likedId: targetUser.id,
                    liked: true,
                    message: 'This is a valid message that meets the 20 character minimum requirement',
                },
            });
            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty('id');
            expect(body.likedId).toBe(targetUser.id);
            expect(body.liked).toBe(true);
        });
    });

    /** POST /api/likes/:likeId/accept – Accept Like Validation */
    describe('POST /api/likes/:likeId/accept', () => {
        /** Scenario: likeId not a valid CUID. Expected: 400 response. */
        it('should reject invalid likeId format', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/likes/invalid-id/accept',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {},
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Invalid like ID format');
        });

        /** Scenario: replyMessage exceeds 500 characters. Expected: 400 response. */
        it('should reject reply message longer than 500 characters', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/likes/${cuid()}/accept`,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                payload: {
                    replyMessage: 'a'.repeat(501),
                },
            });
            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Reply message cannot exceed 500 characters');
        });
    });
});
