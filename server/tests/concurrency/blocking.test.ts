/**
 * @file tests/concurrency/blocking.test.ts
 * @description Concurrency tests for blocking operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../../src/services/block.service.js';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Blocking Concurrency', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should not create duplicate blocks per direction when concurrent mutual blocking
     */
    it('concurrent mutual blocking creates no duplicate blocks per direction', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        // Create prerequisite interactions
        await likeService.createLike(user1.id, user2.id, true, 'Hello there!');
        await likeService.createLike(user2.id, user1.id, true, 'Hi back!');

        const results = await Promise.allSettled([
            blockService.blockUser(user1.id, user2.id),
            blockService.blockUser(user2.id, user1.id),
        ]);

        // At least one should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Check blocks
        const blocks = await prisma.block.findMany({
            where: {
                OR: [
                    { blockerId: user1.id, blockedId: user2.id },
                    { blockerId: user2.id, blockedId: user1.id },
                ],
            },
        });

        // Should have at most 2 blocks (one per direction)
        expect(blocks.length).toBeLessThanOrEqual(2);
    });

    /**
     * Should be idempotent - blocking same user 5x concurrently creates 1 record
     */
    it('blocking same user 5x concurrently is idempotent, creates 1 record', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        // Create prerequisite interaction
        await likeService.createLike(user2.id, user1.id, true, 'Hello there!');

        const results = await Promise.allSettled([
            blockService.blockUser(user1.id, user2.id),
            blockService.blockUser(user1.id, user2.id),
            blockService.blockUser(user1.id, user2.id),
            blockService.blockUser(user1.id, user2.id),
            blockService.blockUser(user1.id, user2.id),
        ]);

        // At least one should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Should have exactly 1 block
        const blocks = await prisma.block.findMany({
            where: {
                blockerId: user1.id,
                blockedId: user2.id,
            },
        });

        expect(blocks).toHaveLength(1);
    });
});
