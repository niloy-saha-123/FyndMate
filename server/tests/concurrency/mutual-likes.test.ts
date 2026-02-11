/**
 * @file tests/concurrency/mutual-likes.test.ts
 * @description Concurrency tests for mutual likes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Mutual Likes Concurrency', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should create exactly 1 match when simultaneous mutual likes occur
     */
    it('simultaneous mutual likes creates exactly 1 match', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const results = await Promise.allSettled([
            likeService.createLike(user1.id, user2.id, true, 'Hello from 1!'),
            likeService.createLike(user2.id, user1.id, true, 'Hello from 2!'),
        ]);

        // At least one should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Check that exactly 1 match was created
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { user1Id: user1.id, user2Id: user2.id },
                    { user1Id: user2.id, user2Id: user1.id },
                ],
            },
        });

        expect(matches).toHaveLength(1);
    });

    /**
     * Should not create duplicate likes when concurrent
     */
    it('concurrent likes to same user creates no duplicate likes', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const results = await Promise.allSettled([
            likeService.createLike(user1.id, user2.id, true, 'Hello there 1!'),
            likeService.createLike(user1.id, user2.id, true, 'Hello there 2!'),
            likeService.createLike(user1.id, user2.id, true, 'Hello there 3!'),
        ]);

        // At least one should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Only 1 like should exist
        const likes = await prisma.like.findMany({
            where: {
                likerId: user1.id,
                likedId: user2.id,
            },
        });

        expect(likes).toHaveLength(1);
    });
});
