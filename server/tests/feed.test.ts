/**
 * @file server/tests/feed.test.ts
 * @description Test suite for the FeedService.
 *
 * Covers:
 * - Generating the Discovery Feed (Potential matches).
 * - Excluding users already Liked or Passed.
 * - Excluding users who Blocked me or I Blocked.
 * - Handling Asymmetric visibility (If they passed me, I can still see them until I act).
 * - Handling "Likes You" exclusion (People who liked me shouldn't be in feed, they go to Likes tab).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { feedService } from '../src/services/feed.service.js';
import { likeService } from '../src/services/like.service.js';
import { blockService } from '../src/services/block.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';

describe('FeedService', () => {
    let me: any;
    let alice: any;
    let bob: any;
    let charlie: any;

    beforeEach(async () => {
        await clearDatabase();
        // Create users
        me = await createDummyUser("Me");
        alice = await createDummyUser("Alice");
        bob = await createDummyUser("Bob");
        charlie = await createDummyUser("Charlie");
    });

    /**
     * Test: Basic Feed Generation
     * Scenario: Fetch the discovery feed for a user.
     * Expected: Returns a list of compatible users (excluding self, already interacted, etc).
     */
    it('should return compatible users in the feed', async () => {
        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(3);
        const names = feed.map(u => u.name).sort();
        expect(names).toEqual(["Alice", "Bob", "Charlie"]);
    });

    /**
     * Test: Filter Liked Users
     * Scenario: User has already Liked Alice.
     * Expected: Alice should not appear in the feed again.
     */
    it('should exclude users I have already liked', async () => {
        // I like Alice
        await likeService.createLike(me.id, alice.id, true, "Hi Alice! This is a long intro message.");

        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain("Alice");
    });

    /**
     * Test: Filter Passed Users
     * Scenario: User has already Passed Bob.
     * Expected: Bob should not appear in the feed again.
     */
    it('should exclude users I have passed', async () => {
        // I pass Bob
        await likeService.createLike(me.id, bob.id, false);

        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain("Bob");
    });

    /**
     * Test: Likes You Exclusion
     * Scenario: Charlie Liked Me.
     * Expected: Charlie should NOT appear in the main feed. He belongs in the "Likes You" section.
     */
    it('should exclude users who have liked me (they belong in Likes You section)', async () => {
        // Charlie likes Me
        await likeService.createLike(charlie.id, me.id, true, "Hi Me! This is a long intro message...");

        const feed = await feedService.getFeed(me.id);
        expect(feed).toHaveLength(2);
        expect(feed.map(u => u.name)).not.toContain("Charlie");
    });

    /**
     * Test: Asymmetric Visibility
     * Scenario: Alice passed Me. I haven't seen her yet.
     * Expected: I should still see Alice in my feed (until I act on her). her action doesn't hide her from me.
     */
    it('should NOT exclude users who have passed me (asymmetric visibility)', async () => {
        // Alice passes Me. Asymmetric: I haven't seen her yet.
        await likeService.createLike(alice.id, me.id, false);

        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).toContain("Alice");
    });

    /**
     * Test: Filter Blocked Users (Outgoing)
     * Scenario: I blocked Alice.
     * Expected: Alice should not ensure in my feed.
     */
    it('should exclude users I have blocked', async () => {
        // Interact first
        await likeService.createLike(me.id, alice.id, true, "Pre-block interaction message.......");
        await blockService.blockUser(me.id, alice.id);
        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).not.toContain("Alice");
    });

    /**
     * Test: Filter Blocked Users (Incoming)
     * Scenario: Bob blocked Me.
     * Expected: Bob should not appear in my feed.
     */
    it('should exclude users who blocked me', async () => {
        // Interact first
        await likeService.createLike(bob.id, me.id, true, "Pre-block interaction message.......");
        await blockService.blockUser(bob.id, me.id);
        const feed = await feedService.getFeed(me.id);
        expect(feed.map(u => u.name)).not.toContain("Bob");
    });
});
