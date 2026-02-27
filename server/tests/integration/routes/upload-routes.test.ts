/**
 * @file tests/integration/routes/upload-routes.test.ts
 * @description Integration tests for upload routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase } from '../../helpers.js';

describe('Upload Routes', () => {
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
     * Should return signed URL
     */
    it('POST .../request returns signed URL', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'jpg',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('signedUrl');
        expect(body).toHaveProperty('uploadPath');
    });

    /**
     * Should reject missing fileExtension
     */
    it('rejects missing fileExtension', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {},
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject gif extension
     */
    it('rejects gif', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'gif',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject exe extension
     */
    it('rejects exe', async () => {
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

    /**
     * Should accept jpg
     */
    it('accepts jpg', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'jpg',
            },
        });

        expect(response.statusCode).toBe(200);
    });

    /**
     * Should accept png
     */
    it('accepts png', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'png',
            },
        });

        expect(response.statusCode).toBe(200);
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
     * Should reject fileSizeBytes > 5MB
     */
    it('rejects fileSizeBytes > 5MB', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/request',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                fileExtension: 'jpg',
                fileSizeBytes: 1024 * 1024 * 6, // 6MB
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject confirm with missing uploadPath
     */
    it('POST .../confirm rejects missing uploadPath', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {},
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject confirm without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/upload/profile-picture/confirm',
            payload: {
                uploadPath: 'profile-pictures/user123.jpg',
            },
        });

        expect(response.statusCode).toBe(401);
    });
});
