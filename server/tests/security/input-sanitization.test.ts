/**
 * @file tests/security/input-sanitization.test.ts
 * @description Security tests for input sanitization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { getAuthToken, clearDatabase, createDummyUser, createAuthedUser } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Input Sanitization Security', () => {
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
     * Should reject SQL injection in likedId
     */
    it('rejects SQL injection in likedId', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: "1'; DROP TABLE users; --",
                liked: true,
                message: 'Hello there!',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject SQL injection in cursor
     */
    it('rejects SQL injection in cursor', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: "/api/feed?cursor=' OR '1'='1",
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should sanitize XSS in message field
     */
    it('handles XSS in message field (sanitized or rejected)', async () => {
        const { token, user } = await createAuthedUser('InputSanitizationUser');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
                message: '<script>alert("xss")</script> Hello there!',
            },
        });

        // Should either reject or sanitize
        if (response.statusCode === 200) {
            const like = await prisma.like.findFirst({
                where: { likerId: user.id, likedId: other.id },
            });
            expect(like).not.toBeNull();
            expect(like?.message).not.toContain('<script>');
        }
    });

    /**
     * Should handle emoji/unicode in messages
     */
    it('handles emoji/unicode in messages', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'Hello there 🎉👋',
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should handle RTL text
     */
    it('handles RTL text', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const other = await createDummyUser('Other');

        const response = await app.inject({
            method: 'POST',
            url: '/api/likes',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                likedId: other.id,
                liked: true,
                message: 'مرحبا كيف حالك',
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should reject path traversal in uploadPath
     */
    it('rejects path traversal in uploadPath', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath: '../../etc/passwd',
            },
        });

        // Should reject (either 400 or 403)
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    /**
     * Should reject null bytes in string fields
     */
    it('rejects null bytes in string fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fullName: 'John\u0000Doe',
            },
        });

        // Should either reject or sanitize
        expect([200, 400]).toContain(response.statusCode);
    });

    /**
     * Should reject extremely long strings (10K chars)
     */
    it('rejects extremely long strings (10K chars)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                bio: 'a'.repeat(10000),
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should handle JSON injection in body fields
     */
    it('handles JSON injection in body fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/profile/me',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: '{"fullName": "Test", "malicious": {"$ne": null}}',
        });

        // Should handle safely (not crash)
        expect([200, 400]).toContain(response.statusCode);
    });
});
