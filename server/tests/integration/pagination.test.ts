/**
 * @file tests/integration/pagination.test.ts
 * @description Integration tests for feed and matches cursor pagination.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createAuthedUser, getAuthToken, clearDatabase, createDummyUser } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Pagination', () => {
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

    it('paginates feed with cursor', async () => {
        const token = await getAuthToken('feed-user', 'feed@example.com');

        const targets = await Promise.all([
            createDummyUser('FeedA'),
            createDummyUser('FeedB'),
            createDummyUser('FeedC'),
        ]);

        const page1 = await app.inject({
            method: 'GET',
            url: '/api/feed?limit=2',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(page1.statusCode).toBe(200);
        const body1 = JSON.parse(page1.body);
        expect(body1.data).toHaveLength(2);

        const nextCursor = body1.data[body1.data.length - 1].id;
        const page2 = await app.inject({
            method: 'GET',
            url: `/api/feed?limit=2&cursor=${nextCursor}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(page2.statusCode).toBe(200);
        const body2 = JSON.parse(page2.body);
        // Remaining one user
        expect(body2.data.length).toBeGreaterThanOrEqual(1);
    });

    it('paginates matches with cursor and limit cap', async () => {
        const { token, user: me } = await createAuthedUser('Matcher');

        const others = await Promise.all([
            createDummyUser('Match1'),
            createDummyUser('Match2'),
            createDummyUser('Match3'),
        ]);

        // Create matches directly
        for (const other of others) {
            await prisma.match.create({
                data: {
                    user1Id: me.id,
                    user2Id: other.id,
                    status: 'active',
                },
            });
        }

        const page1 = await app.inject({
            method: 'GET',
            url: '/api/matches?limit=2',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(page1.statusCode).toBe(200);
        const body1 = JSON.parse(page1.body);
        expect(body1.data).toHaveLength(2);
        expect(body1.nextCursor).toBeDefined();

        const page2 = await app.inject({
            method: 'GET',
            url: `/api/matches?limit=2&cursor=${body1.nextCursor}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(page2.statusCode).toBe(200);
        const body2 = JSON.parse(page2.body);
        expect(body2.data.length).toBeGreaterThanOrEqual(1);
    });
});
