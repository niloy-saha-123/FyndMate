/**
 * @file tests/integration/routes/location-routes.test.ts
 * @description Integration tests for location routes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { getAuthToken, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('Location Routes', () => {
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
     * Should return 200 with locationSecret
     */
    it('GET /api/users/me/location-secret returns 200 with locationSecret', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/users/me/location-secret',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('locationSecret');
    });

    /**
     * Should generate secret if none exists
     */
    it('generates secret if none exists', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'GET',
            url: '/api/users/me/location-secret',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });

        const body = JSON.parse(response.body);
        expect(body.locationSecret).toBeDefined();
        expect(body.locationSecret).not.toBeNull();
    });

    /**
     * Should reject without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/users/me/location-secret',
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should update location settings
     */
    it('PATCH /api/users/me/location-settings returns 200', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location-settings',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                locationSharing: 'on',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('locationSharing');
    });

    /**
     * Should reject invalid enum value
     */
    it('rejects invalid enum value', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location-settings',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                locationSharing: 'invalid',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject location settings without auth
     */
    it('rejects without auth', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location-settings',
            payload: {
                locationSharing: 'on',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject location update without auth
     */
    it('PATCH /api/users/me/location rejects without auth', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            payload: {
                latitude: 40.7128,
                longitude: -74.006,
                timestamp: Date.now(),
                nonce: 'test-nonce',
                signature: 'test-signature',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    /**
     * Should reject missing required fields
     */
    it('rejects missing required fields', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject latitude out of range
     */
    it('rejects latitude out of range', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 100,
                longitude: -74.006,
                timestamp: Date.now(),
                nonce: 'test-nonce',
                signature: 'test-signature',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    /**
     * Should reject longitude out of range
     */
    it('rejects longitude out of range', async () => {
        const token = await getAuthToken('test-user', 'test@example.com');

        const response = await app.inject({
            method: 'PATCH',
            url: '/api/users/me/location',
            headers: {
                authorization: `Bearer ${token}`,
            },
            payload: {
                latitude: 40.7128,
                longitude: -200,
                timestamp: Date.now(),
                nonce: 'test-nonce',
                signature: 'test-signature',
            },
        });

        expect(response.statusCode).toBe(400);
    });
});
