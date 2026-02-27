/**
 * @file tests/error-paths/like-errors.test.ts
 * @description Error path tests for like operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';

describe('Like Error Paths', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should reject self-like
     */
    it('rejects self-like', async () => {
        const user = await createDummyUser('User');

        await expect(
            likeService.createLike(user.id, user.id, true, 'Hello myself!')
        ).rejects.toThrow('Cannot like yourself');
    });

    /**
     * Should prevent duplicate likes
     */
    it('prevents duplicate likes', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        await expect(
            likeService.createLike(user1.id, user2.id, true, 'Hello again!')
        ).rejects.toThrow('already liked');
    });

    /**
     * Should allow pass → like transition (second chance)
     */
    it('allows pass → like transition (second chance)', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        await likeService.createLike(user1.id, user2.id, false);

        const result = await likeService.createLike(
            user1.id,
            user2.id,
            true,
            'Changed my mind!'
        );

        expect(result).toHaveProperty('liked', true);
    });

    /**
     * Should reject likes to non-existent users
     */
    it('rejects likes to non-existent users', async () => {
        const user = await createDummyUser('User');
        const fakeId = crypto.randomUUID();

        await expect(
            likeService.createLike(user.id, fakeId, true, 'Hello there!')
        ).rejects.toThrow('Cannot interact with this user');
    });
});
