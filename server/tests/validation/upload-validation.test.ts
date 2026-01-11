/**
 * @file tests/validation/upload-validation.test.ts
 * @description Validation tests for Upload API routes.
 * 
 * Verifies validation logic for profile picture upload requests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Upload Route Validation Suite.
 * Sets up Fastify app and an authenticated user to test upload endpoints.
 */
describe('Upload Route Validation', () => {
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
     * POST /api/upload/profile-picture/request
     */
    describe('POST /api/upload/profile-picture/request', () => {
        /**
         * Scenario: Body is missing 'fileName'.
         * Expected: Validation error.
         */
        it('should reject request missing fileName', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/upload/profile-picture/request',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                payload: {
                    fileType: 'image/jpeg'
                    // missing fileName
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.details).toContain("File extension must be");
        });

        /**
         * Scenario: Body is missing 'fileType'.
         * Expected: Validation error.
         */
        it('should reject request missing fileType', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/upload/profile-picture/request',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                payload: {
                    fileName: 'avatar.jpg'
                    // missing fileType
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.details).toContain("File extension must be");
        });

        /**
         * Scenario: 'fileType' is not an image (e.g. application/pdf).
         * Expected: Validation error rejecting non-image types.
         */
        it('should reject invalid fileType', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/upload/profile-picture/request',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                payload: {
                    fileName: 'document.pdf',
                    fileType: 'application/pdf' // Not allowed
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.details).toContain("File extension must be");
        });
    });

    /**
     * POST /api/upload/profile-picture/confirm
     */
    describe('POST /api/upload/profile-picture/confirm', () => {
        /**
         * Scenario: Body is missing 'fileName' for confirmation.
         * Expected: Validation error.
         */
        it('should reject confirmation missing fileName', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/upload/profile-picture/confirm',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                payload: {
                    // missing fileName
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.details).toMatch(/Required|Invalid input/i);
        });
    });
});
