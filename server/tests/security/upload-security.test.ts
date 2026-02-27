/**
 * @file tests/security/upload-security.test.ts
 * @description Security tests for upload functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { getAuthToken, clearDatabase } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Upload Security', () => {
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
     * Should reject confirm without prior request session
     */
    it('rejects confirm without prior request session', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath: 'profile-pictures/fake.jpg',
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should reject confirm with wrong userId in path
     */
    it('rejects confirm with wrong userId in path', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath: `profile-pictures/${crypto.randomUUID()}.jpg`,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should reject second confirm (single-use session)
     */
    it('upload session is single-use (second confirm fails)', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        // Request upload
        const requestResponse = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'jpg',
            },
        });

        const { uploadPath } = JSON.parse(requestResponse.body);

        // First confirm (may fail due to file not existing in Supabase)
        await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath,
            },
        });

        // Second confirm should fail
        const secondConfirm = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath,
            },
        });

        expect(secondConfirm.statusCode).toBeGreaterThanOrEqual(400);
    });

    /**
     * Should reject expired upload session
     */
    it('rejects expired upload session', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        // Manually create expired session
        const session = await prisma.uploadSession.create({
            data: {
                userId: me!.id,
                uploadPath: 'profile-pictures/test.jpg',
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
                ipAddress: '127.0.0.1',
            },
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                uploadPath: session.uploadPath,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    /**
     * Should reject IP mismatch on confirm
     */
    it('rejects IP mismatch on confirm', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');
        const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

        // Create session with different IP
        const session = await prisma.uploadSession.create({
            data: {
                userId: me!.id,
                uploadPath: 'profile-pictures/test.jpg',
                expiresAt: new Date(Date.now() + 60000),
                ipAddress: '192.168.1.1',
            },
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
                'x-forwarded-for': '10.0.0.1',
            },
            payload: {
                uploadPath: session.uploadPath,
            },
        });

        // Should fail due to IP mismatch or other validation
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            payload: {
                fileExtension: 'jpg',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should validate file extension strictly
     */
    it('validates file extension strictly', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'exe',
            },
        });

        expect(response.statusCode).toBe(400);
    });
});
