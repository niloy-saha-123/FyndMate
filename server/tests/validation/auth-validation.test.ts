/**
 * @file tests/validation/auth-validation.test.ts
 * @description Validation tests for Authentication routes.
 * 
 * Tests that the Signup API properly rejects requests with missing or invalid fields.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { clearDatabase } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Authentication Route Validation Suite.
 * Sets up the Fastify app for testing public auth endpoints.
 */
describe('Auth Route Validation', () => {
    let app: FastifyInstance;

    /** Initialise Fastify application before all tests. */
    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    /** Reset database before each test. */
    beforeEach(async () => {
        await clearDatabase();
    });

    /** Close the Fastify instance after all tests have run. */
    afterAll(async () => {
        await app.close();
    });

    /**
     * POST /auth/signup - Signup Validation
     */
    describe('POST /auth/signup', () => {
        /**
         * Scenario: Signup request is missing the 'email' field.
         * Expected: Rejection (400 Bad Request) indicating missing fields.
         */
        it('should reject signup missing email', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                headers: { 'Content-Type': 'application/json' },
                payload: {
                    password: 'password123',
                    name: 'Test User'
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Missing fields');
        });

        /**
         * Scenario: Signup request is missing the 'password' field.
         * Expected: Rejection (400 Bad Request) indicating missing fields.
         */
        it('should reject signup missing password', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                headers: { 'Content-Type': 'application/json' },
                payload: {
                    email: 'test@example.com',
                    name: 'Test User'
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Missing fields');
        });

        /**
         * Scenario: Signup request is missing the 'name' field.
         * Expected: Rejection (400 Bad Request) indicating missing fields.
         */
        it('should reject signup missing name', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/signup',
                headers: { 'Content-Type': 'application/json' },
                payload: {
                    email: 'test@example.com',
                    password: 'password123'
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('Missing fields');
        });
    });
});
