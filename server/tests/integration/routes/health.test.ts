/**
 * @file tests/integration/routes/health.test.ts
 * @description Integration tests for health check routes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';

describe('Health Routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    /**
     * Should return 200 with status ok and timestamp
     */
    it('GET /health returns 200 with status ok and timestamp', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeDefined();
    });

    /**
     * Should have correct response shape
     */
    it('response has correct shape', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('status');
        expect(body).toHaveProperty('timestamp');
    });

    /**
     * Should return 200 with status field for Redis health check
     */
    it('GET /health/redis returns 200 with status field', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health/redis',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('status');
    });

    /**
     * Should return timestamp for Redis health check
     */
    it('GET /health/redis returns timestamp', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health/redis',
        });

        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('timestamp');
    });
});
