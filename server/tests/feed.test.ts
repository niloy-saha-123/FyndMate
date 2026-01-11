/**
 * @file server/tests/feed.test.ts
 * @description Test suite for the FeedService.
 *
 * This suite validates feed generation, ensuring that:
 *   - The discovery feed returns compatible users.
 *   - Users already liked, passed, blocked, or who have liked the current user are excluded appropriately.
 *   - Asymmetric visibility rules are respected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { feedService } from '../src/services/feed.service.js';
import { likeService } from '../src/services/like.service.js';
import { blockService } from '../src/services/block.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';

/**
 * FeedService test suite.
 * Sets up a fresh set of users before each test and validates the feed output.
 */
describe('FeedService', () => {
    let me: any;
    let alice: any;
    let bob: any;
    let charlie: any;

    /** Initialise a clean database and create four dummy users. */
    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
        charlie = await createDummyUser('Charlie');
    });

    /**
     * Basic Feed Generation
     * Scenario: Retrieve the discovery feed for `me` with no prior interactions.
     * Expected: All other users (Alice, Bob, Charlie) are returned.
     */
    it('should return compatible users in the feed', async () => {
        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(3);
        const names = feed.map(u => u.name).sort();
        expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    /**
     * Exclude Users Already Liked
     * Scenario: `me` has liked Alice.
     * Expected: Alice is omitted from the feed.
     */
    it('should exclude users I have already liked', async () => {
        await likeService.createLike(me.id, alice.id, true, 'Hi Alice! This is a long intro message.');
        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain('Alice');
    });

    /**
     * Exclude Users Already Passed
     * Scenario: `me` has passed Bob.
     * Expected: Bob does not appear in the feed.
     */
    it('should exclude users I have passed', async () => {
        await likeService.createLike(me.id, bob.id, false);
        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain('Bob');
    });

    /**
     * Likes‑You Exclusion
     * Scenario: Charlie has liked `me`.
     * Expected: Charlie is excluded from the main feed and should appear in the "Likes You" section.
     */
    it('should exclude users who have liked me (they belong in Likes You section)', async () => {
        await likeService.createLike(charlie.id, me.id, true, 'Hi Me! This is a long intro message...');
        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain('Charlie');
    });

    /**
     * Asymmetric Visibility
     * Scenario: Alice has passed `me` but `me` has not interacted with Alice.
     * Expected: Alice remains visible to `me` because the visibility rule is asymmetric.
     */
    it('should NOT exclude users who have passed me (asymmetric visibility)', async () => {
        await likeService.createLike(alice.id, me.id, false);
        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).toContain('Alice');
    });

    /**
     * Exclude Outgoing Blocked Users
     * Scenario: `me` blocks Alice after receiving an incoming like.
     * Expected: Alice is removed from the feed.
     */
    it('should exclude users I have blocked', async () => {
        await likeService.createLike(alice.id, me.id, true, 'Incoming like from Alice to allow blocking');
        await blockService.blockUser(me.id, alice.id);
        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).not.toContain('Alice');
    });

    /**
     * Exclude Incoming Blocked Users
     * Scenario: Bob blocks `me` after `me` liked Bob.
     * Expected: Bob does not appear in `me`'s feed.
     */
    it('should exclude users who blocked me', async () => {
        await likeService.createLike(me.id, bob.id, true, 'Outgoing like to Bob to allow him to block me');
        await blockService.blockUser(bob.id, me.id);
        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).not.toContain('Bob');
    });
});
