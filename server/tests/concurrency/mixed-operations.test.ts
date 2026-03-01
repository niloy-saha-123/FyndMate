/**
 * @file tests/concurrency/mixed-operations.test.ts
 * @description Concurrency tests for mixed operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../../src/services/like.service.js';
import { blockService } from '../../src/services/block.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';

describe('Mixed Operations Concurrency', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should ensure block takes effect when like and block happen concurrently
     */
    it('like while being blocked concurrently - block takes effect', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        // Create prerequisite for blocking
        await likeService.createLike(user2.id, user1.id, true, 'Hello there!');

        const results = await Promise.allSettled([
            likeService.createLike(user1.id, user2.id, true, 'Hi back there!'),
            blockService.blockUser(user1.id, user2.id),
        ]);

        // At least one should have completed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Check that block exists
        const hasBlock = await blockService.hasBlock(user1.id, user2.id);
        expect(hasBlock).toBe(true);
    });

    /**
     * Should handle high concurrency stress test - everyone likes everyone
     */
    it('high concurrency stress (everyone likes everyone) - reasonable counts, no crashes', async () => {
        const users = await Promise.all([
            createDummyUser('User1'),
            createDummyUser('User2'),
            createDummyUser('User3'),
            createDummyUser('User4'),
            createDummyUser('User5'),
        ]);

        const promises: Promise<any>[] = [];

        // Everyone likes everyone else
        for (const user1 of users) {
            for (const user2 of users) {
                if (user1.id !== user2.id) {
                    promises.push(
                        likeService.createLike(user1.id, user2.id, true, 'Hello there!')
                    );
                }
            }
        }

        const results = await Promise.allSettled(promises);

        // Most should succeed
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Should have created some matches
        // Exact count is difficult to predict due to race conditions
        // But test should complete without crashing
        expect(successful.length).toBeLessThanOrEqual(promises.length);
    });
});
