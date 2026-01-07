/**
 * @file server/tests/match.test.ts
 * @description Test suite for the MatchService.
 *
 * Covers:
 * - Accepting Likes (Converting them to Matches).
 * - Creating initial conversation messages (Intro + Reply).
 * - Retrieving Matches (The "Inbox").
 * - Unmatching users (Soft delete).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { matchService } from '../src/services/match.service.js';
import { likeService } from '../src/services/like.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';

describe('MatchService', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser("Me");
        alice = await createDummyUser("Alice");
    });

    /**
     * Test: Accept Like -> Match
     * Scenario: A user receives a Like (Swipe Right) and responds with an action that creates a match.
     * Expected: Match is created with 'active' status and correct participants.
     */
    it('should create a match when accepting a like', async () => {
        // 1. Alice likes Me
        const like = await likeService.createLike(alice.id, me.id, true, "I like you! This message is long enough.");

        // 2. Me accepts the like
        const match = await matchService.acceptLike(like.id, "I like you too!");

        expect(match.status).toBe('active');
        expect([match.user1Id, match.user2Id]).toContain(me.id);
        expect([match.user1Id, match.user2Id]).toContain(alice.id);
    });

    /**
     * Test: Initial Conversation Generation
     * Scenario: Upon matching, the initial messages should be generated.
     * Expected: The Liker's intro message and the Accepter's reply are stored as messages in the match.
     */
    it('should create initial messages correctly', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, "Intro message from Alice");
        const match = await matchService.acceptLike(like.id, "Response from Me");

        // Verify messages
        // We need to fetch messages via Prisma directly or match service if it exposed it
        // Or getMatches would return them
        const matches = await matchService.getMatches(me.id);
        const myMatch = matches.find((m: any) => m.id === match.id);

        expect(myMatch).toBeDefined();
        // Check last message (should be my response)
        const lastMsg = myMatch?.messages[0];
        expect(lastMsg?.content).toBe("Response from Me");
    });
    /**
     * Test: Inbox / Match List
     * Scenario: User fetches their list of matches.
     * Expected: Returns sorted matches including the last message preview.
     */
    it('should retrieve Matches correctly (Inbox)', async () => {
        // Create a match
        const like = await likeService.createLike(alice.id, me.id, true, "Intro message from Alice");
        await matchService.acceptLike(like.id, "Response from Me");

        const matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(1);

        const match = matches[0];
        expect(match.messages).toHaveLength(1); // Should have the last message preview
        expect(match.messages[0].content).toBe("Response from Me"); // Last message

        // Helper to return the other user
        const otherUser = match.user1Id === me.id ? match.user2 : match.user1;
        expect(otherUser.name).toBe("Alice");
    });

    /**
     * Test: Unmatching
     * Scenario: User decides to disconnect from a match.
     * Expected: The match is no longer retrievable in the active list.
     */
    it('should allow unmatching', async () => {
        // Setup match
        const like = await likeService.createLike(alice.id, me.id, true, "Intro message from Alice > 20 chars");
        const match = await matchService.acceptLike(like.id, "Reply");

        // Unmatch
        await matchService.unmatch(match.id, me.id);

        // Verify status
        const matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(0); // Should be filtered out by 'active' status check in getMatches
    });

    /**
     * Test: Authorization Security
     * Scenario: A third party user tries to unmatch a conversation they are not part of.
     * Expected: Access denied / Error.
     */
    it('should fail to unmatch if not a participant', async () => {
        const bob = await createDummyUser("Bob");
        const like = await likeService.createLike(alice.id, me.id, true, "Intro message from Alice > 20 chars");
        const match = await matchService.acceptLike(like.id, "Reply");

        await expect(
            matchService.unmatch(match.id, bob.id)
        ).rejects.toThrow("Not authorized");
    });
});
