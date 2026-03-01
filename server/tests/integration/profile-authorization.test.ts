/**
 * @file tests/integration/profile-authorization.test.ts
 * @description Integration tests for profile access authorization rules.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createAuthedUser, getAuthToken, clearDatabase, createDummyUser } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Profile Authorization', () => {
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

    it('denies profile view without match or incoming like', async () => {
        const requesterToken = await getAuthToken('viewer', 'viewer@example.com');
        const target = await createDummyUser('TargetUser');

        const response = await app.inject({
            method: 'GET',
            url: `/api/profile/${target.id}`,
            headers: { authorization: `Bearer ${requesterToken}` },
        });

        expect(response.statusCode).toBe(403);
    });

    it('allows profile view when there is a match', async () => {
        const { token, user: requester } = await createAuthedUser('Viewer');
        const target = await createDummyUser('Target');

        await prisma.match.create({
            data: {
                user1Id: requester.id,
                user2Id: target.id,
                status: 'active',
            },
        });

        const response = await app.inject({
            method: 'GET',
            url: `/api/profile/${target.id}`,
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
    });
});
