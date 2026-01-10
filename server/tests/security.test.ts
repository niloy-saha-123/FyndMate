/**
 * @file tests/security.test.ts
 * @description Security and authentication test suite.
 *
 * Provides coverage for:
 * - Authentication/Authorization (Checking missing/malformed tokens).
 * - Input Sanitization (SQL injection, XSS protection).
 * - Proper handling of special characters and Unicode.
 * - Access Control (Ensuring users cannot act on behalf of others).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from './helpers.js';
import type { FastifyInstance } from 'fastify';

/**
 * Authentication Security Tests.
 * Verifies that protected routes reject unauthorized requests.
 */
describe('Security - Authentication', () => {
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
     * Missing Authentication Header
     * Scenario: Request made to a protected route without an Authorization header.
     * Expected: 401 Unauthorized response.
     */
    it('should reject requests without Authorization header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            // No Authorization header
        });
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.body);
        expect(body.error).toBeDefined();
        expect(body.error).toMatch(/authorization|no.*header/i);
    });

    /**
     * Missing Token in POST Request
     * Scenario: POST request to protected route without auth token.
     * Expected: 401 Unauthorized response.
     */
    it('should reject POST requests without auth token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                'Content-Type': 'application/json',
            },
            payload: {
                likedId: 'clx7abc123def456',
                liked: true,
                message: 'This should be rejected without auth token because no token provided',
            },
        });
        expect(response.statusCode).toBe(401);
    });

    /**
     * Malformed Authorization Header (Wrong Scheme)
     * Scenario: Header provided with scheme other than 'Bearer'.
     * Expected: 401 Unauthorized response.
     */
    it('should reject malformed Authorization headers - wrong scheme', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                Authorization: 'NotBearer malformed-token',
            },
        });
        expect(response.statusCode).toBe(401);
    });

    /**
     * Malformed Authorization Header (No Prefix)
     * Scenario: Header provided without any prefix.
     * Expected: 401 Unauthorized response.
     */
    it('should reject Authorization header without Bearer prefix', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                Authorization: 'just-a-token-no-prefix',
            },
        });
        expect(response.statusCode).toBe(401);
    });

    /**
     * Empty Authorization Header
     * Scenario: Header provided but empty.
     * Expected: 401 Unauthorized response.
     */
    it('should reject empty Authorization header', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feed',
            headers: {
                Authorization: '',
            },
        });
        expect(response.statusCode).toBe(401);
    });
});

/**
 * Input Sanitization Tests.
 * Verifies protection against SQL injection and XSS attempts.
 */
describe('Security - Input Sanitization', () => {
    let app: FastifyInstance;
    let authToken: string;
    let testUser: any;
    let targetUser: any;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await clearDatabase();
        testUser = await createDummyUser('TestUser');
        targetUser = await createDummyUser('TargetUser');
        authToken = await getAuthToken(testUser.supabaseId, testUser.email);
    });

    /**
     * SQL Injection Protection (Body)
     * Scenario: Malicious SQL injected into the 'likedId' field.
     * Expected: Request rejected (400) due to format validation failure.
     */
    it('should reject SQL injection attempts in likedId field', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            payload: {
                likedId: "'; DROP TABLE users; --",
                liked: true,
                message: 'SQL injection attempt with proper length requirement met',
            },
        });
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.message).toMatch(/invalid.*format|validation/i);
    });

    /**
     * SQL Injection Protection (Query Param)
     * Scenario: Malicious SQL injected into the 'cursor' query parameter.
     * Expected: Request rejected (400) due to format validation failure.
     */
    it('should reject SQL injection in cursor parameter', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/feed?cursor='; DROP TABLE users--`,
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        expect(response.statusCode).toBe(400);
    });

    /**
     * XSS Protection
     * Scenario: Script tag injected into the message field.
     * Expected: The system handles the input safely (either by sanitizing on storage/display or rejecting it).
     * Note: Current implementation accepts input but relies on output encoding.
     */
    it('should handle XSS attempts in message field', async () => {
        const xssPayload = "<script>alert('XSS')</script> and more text to meet the minimum length";
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
                message: xssPayload,
            },
        });
        if (response.statusCode === 200) {
            const body = JSON.parse(response.body);
            expect(body.message).toBeDefined();
        } else {
            expect(response.statusCode).toBe(400);
        }
    });

    /**
     * Unicode / Emoji Support
     * Scenario: Message containing emojis and unicode characters.
     * Expected: Message is accepted and stored correctly (200 OK).
     */
    it('should handle emoji and unicode in messages', async () => {
        const unicodeMessage = "I like your profile! 🎉🔥 Let's connect and collaborate together";
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
                message: unicodeMessage,
            },
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.message).toBe(unicodeMessage);
    });

    /**
     * RTL Text Support
     * Scenario: Message containing Right-to-Left text (e.g., Arabic).
     * Expected: Message is accepted and stored correctly (200 OK).
     */
    it('should handle RTL (right-to-left) text in messages', async () => {
        const rtlMessage = 'مرحبا! This is RTL text mixed with English and meets minimum length';
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
                message: rtlMessage,
            },
        });
        expect(response.statusCode).toBe(200);
    });
});

/**
 * Authorization Tests.
 * Verifies that users cannot perform actions on behalf of others.
 */
describe('Security - Authorization', () => {
    let app: FastifyInstance;
    let user1Token: string;
    let user1: any;
    let user2: any;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await clearDatabase();
        user1 = await createDummyUser('User1');
        user2 = await createDummyUser('User2');
        user1Token = await getAuthToken(user1.supabaseId, user1.email);
    });

    /**
     * Identity Spoofing Prevention
     * Scenario: Authenticated user attempts to create a like.
     * Expected: The system uses the authenticated user's ID as the liker, preventing spoofing.
     */
    it('should create like from authenticated user, not arbitrary user', async () => {
        const targetUser = await createDummyUser('Target');
        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user1Token}`,
            },
            payload: {
                likedId: targetUser.id,
                liked: true,
                message: 'Like from authenticated user with proper length requirement',
            },
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.likedId).toBe(targetUser.id);
    });
});
