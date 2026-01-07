/**
 * @file server/tests/like.test.ts
 * @description Test suite for the LikeService.
 *
 * Covers:
 * - Creating Likes (Swiping Right) with validation (message length, self-like, blocks).
 * - Passing Users (Swiping Left).
 * - Instant Matches (Reciprocal Likes).
 * - Retrieving "Received Likes" (Hinge-style likes view).
 * - "Second Chance": Updating a previous Pass to a Like.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../src/services/like.service.js';
import { blockService } from '../src/services/block.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';

describe('LikeService', () => {
    let me: any;
    let alice: any;
    let bob: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser("Me");
        alice = await createDummyUser("Alice");
        bob = await createDummyUser("Bob");
    });

    /**
     * Test: Standard Like Creation
     * Scenario: User swipes right on another user with a valid introduction message.
     * Expected: A new 'Like' record is created with status 'active'.
     */
    it('should allow sending a Like with a message', async () => {
        const message = "Hi Alice! Nice profile picture."; // > 20 chars
        const like = await likeService.createLike(me.id, alice.id, true, message);

        if ('user1Id' in like) {
            throw new Error("Expected Like, got Match");
        }

        expect(like.liked).toBe(true);
        expect(like.likerId).toBe(me.id);
        expect(like.likedId).toBe(alice.id);
        expect(like.message).toBe(message);
        expect(like.status).toBe('active');
    });

    /**
     * Test: Message Validation
     * Scenario: User attempts to like with a message shorter than 20 characters.
     * Expected: The operation is rejected with a validation error.
     */
    it('should fail if message is too short', async () => {
        await expect(
            likeService.createLike(me.id, alice.id, true, "Hi")
        ).rejects.toThrow("Intro message must be at least 20 characters");
    });

    /**
     * Test: Self-Like Prevention
     * Scenario: User tries to like their own profile.
     * Expected: The operation is rejected.
     */
    it('should fail if liking self', async () => {
        await expect(
            likeService.createLike(me.id, me.id, true, "Self love")
        ).rejects.toThrow("Cannot like yourself");
    });

    /**
     * Test: Block Enforcement
     * Scenario: User tries to like someone they have blocked (or who blocked them).
     * Expected: Interaction is forbidden.
     */
    it('should fail if user is blocked', async () => {
        // Interact first to allow block
        await likeService.createLike(me.id, alice.id, true, "Pre-block interaction message.......");
        await blockService.blockUser(me.id, alice.id);
        await expect(
            likeService.createLike(me.id, alice.id, true, "Blocked message... this must be long enough to trigger block check")
        ).rejects.toThrow("Cannot interact with this user");
    });

    /**
     * Test: Pass Action
     * Scenario: User swipes left (Pass) on another user.
     * Expected: A Like record is created with liked=false and no message.
     */
    it('should allow Passing a user (no message needed)', async () => {
        const pass = await likeService.createLike(me.id, bob.id, false);

        if ('user1Id' in pass) {
            throw new Error("Expected a Like object, but got a Match object");
        }

        expect(pass.liked).toBe(false);
        expect(pass.message).toBeNull();
    });

    /**
     * Test: Instant Match Logic
     * Scenario: Bob has already liked Me. Now I like Bob.
     * Expected: The system detects the reciprocal like and immediately converts it into a Match.
     */
    it('should detect Instant Match (Reciprocal Like)', async () => {
        // 1. Bob likes Me first
        await likeService.createLike(bob.id, me.id, true, "He likes me first......."); // 20+ chars

        // 2. I like Bob back
        const result = await likeService.createLike(me.id, bob.id, true, "I like him back too!....");

        // Should return a Match implementation
        expect(result).toHaveProperty('user1Id');
        // Status should be active
        expect(result.status).toBe('active');
    });

    /**
     * Test: Second Chance
     * Scenario: I previously passed on Bob. I decide to give him a chance and Like him.
     * Expected: The previous 'Pass' record is updated to a 'Like' (active).
     */
    it('should allow "Second Chance" - changing a Pass to a Like', async () => {
        // 1. I pass Bob initially
        await likeService.createLike(me.id, bob.id, false);

        // 2. I change my mind and Like Bob
        const retry = await likeService.createLike(me.id, bob.id, true, "Changed my mind! This is a long message.");

        if ('user1Id' in retry) {
            throw new Error("Expected Like, got Match");
        }

        expect(retry.liked).toBe(true);
        expect(retry.message).toBe("Changed my mind! This is a long message.");
        expect(retry.status).toBe('active');
    });

    /**
     * Test: "Likes You" List
     * Scenario: Retrieve the list of pending likes for the current user.
     * Expected: Only users who actively liked Me (and I haven't acted on yet) are returned. 
     *          People I liked should NOT appear here.
     */
    it('should retrieve "Received Likes" correctly', async () => {
        // Alice likes Me
        await likeService.createLike(alice.id, me.id, true, "Hey there, would love to connect!");

        // Bob likes Me
        await likeService.createLike(bob.id, me.id, true, "Checking if you want to chat....");

        // I like Charlie (should not show up in MY received likes)
        const charlie = await createDummyUser("Charlie");
        await likeService.createLike(me.id, charlie.id, true, "I like Charlie.................");

        const received = await likeService.getReceivedLikes(me.id);
        expect(received).toHaveLength(2);
        const names = received.map((l: any) => l.likerUser.name).sort();
        expect(names).toEqual(["Alice", "Bob"]);
    });
});
