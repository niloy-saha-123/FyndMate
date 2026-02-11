/**
 * @file tests/error-paths/block-errors.test.ts
 * @description Error path tests for block operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../../src/services/block.service.js';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';

describe('Block Error Paths', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should be idempotent - no duplicate records
     */
    it('idempotent blocking (no duplicate records)', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        // Create prerequisite
        await likeService.createLike(user2.id, user1.id, true, 'Hello there!');

        const block1 = await blockService.blockUser(user1.id, user2.id);
        const block2 = await blockService.blockUser(user1.id, user2.id);

        expect(block1.id).toBe(block2.id);
    });

    /**
     * Should prevent self-block
     */
    it('prevents self-block', async () => {
        const user = await createDummyUser('User');

        await expect(blockService.blockUser(user.id, user.id)).rejects.toThrow(
            'Cannot block yourself'
        );
    });

    /**
     * Should reject blocking strangers
     */
    it('rejects blocking strangers', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        await expect(blockService.blockUser(user1.id, user2.id)).rejects.toThrow(
            'can only block users who have liked you or matched'
        );
    });
});
