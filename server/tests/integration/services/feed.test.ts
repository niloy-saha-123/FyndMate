/**
 * @file tests/integration/services/feed.test.ts
 * @description Integration tests for feed service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { feedService } from '../../../src/services/feed.service.js';
import { likeService } from '../../../src/services/like.service.js';
import { blockService } from '../../../src/services/block.service.js';
import { createDummyUser, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('FeedService', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should return compatible users with no interactions
     */
    it('returns compatible users (no interactions)', async () => {
        const me = await createDummyUser('Me');
        await createDummyUser('User1');
        await createDummyUser('User2');
        await createDummyUser('User3');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(3);
    });

    /**
     * Should exclude users I have liked (liked=true)
     */
    it('excludes users I have liked (liked=true)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        await likeService.createLike(me.id, other.id, true, 'Hello there!');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(third.id);
    });

    /**
     * Should NOT exclude users I have passed (liked=false) - second chance feature
     */
    it('does NOT exclude users I have passed (liked=false)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(me.id, other.id, false);

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(other.id);
    });

    /**
     * Should exclude users who have liked me (Likes You section)
     */
    it('excludes users who have liked me (Likes You section)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        await likeService.createLike(other.id, me.id, true, 'Hey there!');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(third.id);
    });

    /**
     * Should NOT exclude users who have passed me (asymmetric)
     */
    it('does NOT exclude users who have passed me (asymmetric)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, false);

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(other.id);
    });

    /**
     * Should exclude users I have blocked
     */
    it('excludes users I have blocked', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        // Create prerequisite: incoming like (required for blocking)
        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await blockService.blockUser(me.id, other.id);

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(third.id);
    });

    /**
     * Should exclude users who blocked me
     */
    it('excludes users who blocked me', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        // Create prerequisite: me likes other first
        await likeService.createLike(me.id, other.id, true, 'Hello there!');
        await blockService.blockUser(other.id, me.id);

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(third.id);
    });

    /**
     * Should exclude matched users
     */
    it('excludes matched users', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        // Create match
        await likeService.createLike(me.id, other.id, true, 'Hello there!');
        await likeService.createLike(other.id, me.id, true, 'Hi back!');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(third.id);
    });

    /**
     * Should return empty array for non-existent user
     */
    it('returns empty array for non-existent user (UUID)', async () => {
        const feed = await feedService.getFeed(crypto.randomUUID(), 20);
        expect(feed).toEqual([]);
    });

    /**
     * Should return empty array when all users exhausted
     */
    it('returns empty array when all exhausted', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(me.id, other.id, true, 'Hello there!');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toEqual([]);
    });

    /**
     * Should respect limit parameter
     */
    it('respects limit parameter', async () => {
        const me = await createDummyUser('Me');
        await createDummyUser('User1');
        await createDummyUser('User2');
        await createDummyUser('User3');
        await createDummyUser('User4');

        const feed = await feedService.getFeed(me.id, 2);
        expect(feed).toHaveLength(2);
    });

    /**
     * Should exclude self from feed
     */
    it('excludes self', async () => {
        const me = await createDummyUser('Me');
        await createDummyUser('Other');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).not.toBe(me.id);
    });

    /**
     * Should exclude banned users
     */
    it('excludes banned users', async () => {
        const me = await createDummyUser('Me');
        await createDummyUser('Banned', { banned: true });
        const normal = await createDummyUser('Normal');

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed).toHaveLength(1);
        expect(feed[0].id).toBe(normal.id);
    });

    /**
     * Should handle cursor-based pagination
     */
    it('handles cursor-based pagination', async () => {
        const me = await createDummyUser('Me');
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const page1 = await feedService.getFeed(me.id, 1);
        expect(page1).toHaveLength(1);

        const cursor = page1[0].id;
        const page2 = await feedService.getFeed(me.id, 1, cursor);
        expect(page2).toHaveLength(1);
        expect(page2[0].id).not.toBe(page1[0].id);
    });

    /**
     * Should not include birthDate in response
     */
    it('does not include birthDate in response', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other', {
            birthDate: new Date('2000-01-01'),
        });

        const feed = await feedService.getFeed(me.id, 20);
        expect(feed[0]).not.toHaveProperty('birthDate');
    });
});
