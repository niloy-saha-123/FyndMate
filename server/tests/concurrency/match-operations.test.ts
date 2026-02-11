/**
 * @file tests/concurrency/match-operations.test.ts
 * @description Concurrency tests for match operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { matchService } from '../../src/services/match.service.js';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Match Operations Concurrency', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should create exactly 1 match when concurrent accept of same like
     */
    it('concurrent accept of same like creates exactly 1 match', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        const results = await Promise.allSettled([
            matchService.acceptLike(like.id),
            matchService.acceptLike(like.id),
            matchService.acceptLike(like.id),
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
     * Should handle concurrent unmatch attempts gracefully
     */
    it('concurrent unmatch attempts - at least 1 succeeds, match is unmatched', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);

        const results = await Promise.allSettled([
            matchService.unmatch(match.id, user1.id),
            matchService.unmatch(match.id, user2.id),
            matchService.unmatch(match.id, user1.id),
        ]);

        // At least one should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Match should be unmatched
        const updatedMatch = await prisma.match.findUnique({
            where: { id: match.id },
        });

        expect(updatedMatch?.status).toBe('unmatched');
    });
});
