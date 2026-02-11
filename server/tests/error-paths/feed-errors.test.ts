/**
 * @file tests/error-paths/feed-errors.test.ts
 * @description Error path tests for feed operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { feedService } from '../../src/services/feed.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';
import { likeService } from '../../src/services/like.service.js';

describe('Feed Error Paths', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should return empty array for empty feed
     */
    it('empty feed returns empty array (not null)', async () => {
        const user = await createDummyUser('User');

        const feed = await feedService.getFeed(user.id, 20);
        expect(feed).toEqual([]);
    });

    /**
     * Should handle invalid user ID
     */
    it('invalid user ID returns empty array', async () => {
        const fakeId = crypto.randomUUID();

        const feed = await feedService.getFeed(fakeId, 20);
        expect(feed).toEqual([]);
    });

    /**
     * Should return empty array for non-existent user
     */
    it('non-existent user returns empty array', async () => {
        const fakeId = crypto.randomUUID();

        const feed = await feedService.getFeed(fakeId, 20);
        expect(feed).toEqual([]);
    });
});
