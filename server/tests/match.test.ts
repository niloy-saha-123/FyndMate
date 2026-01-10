/**
 * @file server/tests/match.test.ts
 * @description Test suite for the MatchService.
 *
 * This suite validates the match creation process (accepting likes),
 * initial message generation, match retrieval (inbox), unmatching (soft delete),
 * and security checks for authorized actions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { matchService } from '../src/services/match.service.js';
import { likeService } from '../src/services/like.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';

/**
 * MatchService test suite.
 * Sets up two dummy users before each test.
 */
describe('MatchService', () => {
    let me: any;
    let alice: any;

    /** Initialise a clean database and create users. */
    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Accept Like → Match Creation
     * Scenario: A user receives a Like and responds with an action that creates a match.
     * Expected: Match is created with 'active' status and correct participants.
     */
    it('should create a match when accepting a like', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, 'I like you! This message is long enough.');
        const match = await matchService.acceptLike(like.id, 'I like you too!');
        expect(match.status).toBe('active');
        expect([match.user1Id, match.user2Id]).toContain(me.id);
        expect([match.user1Id, match.user2Id]).toContain(alice.id);
    });

    /**
     * Initial Conversation Generation
     * Scenario: Upon matching, initial messages should be generated.
     * Expected: The Liker's intro message and the Accepter's reply are stored as messages.
     */
    it('should create initial messages correctly', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, 'Intro message from Alice');
        const match = await matchService.acceptLike(like.id, 'Response from Me');
        const matches = await matchService.getMatches(me.id);
        const myMatch = matches.find((m: any) => m.id === match.id);
        expect(myMatch).toBeDefined();
        const lastMsg = myMatch?.messages[0];
        expect(lastMsg?.content).toBe('Response from Me');
    });

    /**
     * Inbox / Match List Retrieval
     * Scenario: User fetches their list of matches.
     * Expected: Returns sorted matches including the last message preview.
     */
    it('should retrieve Matches correctly (Inbox)', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, 'Intro message from Alice');
        await matchService.acceptLike(like.id, 'Response from Me');
        const matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(1);
        const match = matches[0];
        expect(match.messages).toHaveLength(1);
        expect(match.messages[0].content).toBe('Response from Me');
        const otherUser = match.user1Id === me.id ? match.user2 : match.user1;
        expect(otherUser.name).toBe('Alice');
    });

    /**
     * Unmatching
     * Scenario: User decides to disconnect from a match.
     * Expected: The match is no longer retrievable in the active list (soft deleted).
     */
    it('should allow unmatching', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, 'Intro message from Alice > 20 chars');
        const match = await matchService.acceptLike(like.id, 'Reply');
        await matchService.unmatch(match.id, me.id);
        const matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(0);
    });

    /**
     * Authorization Security
     * Scenario: A third party user tries to unmatch a conversation they are not part of.
     * Expected: The operation is rejected due to lack of authorization.
     */
    it('should fail to unmatch if not a participant', async () => {
        const bob = await createDummyUser('Bob');
        const like = await likeService.createLike(alice.id, me.id, true, 'Intro message from Alice > 20 chars');
        const match = await matchService.acceptLike(like.id, 'Reply');
        await expect(matchService.unmatch(match.id, bob.id)).rejects.toThrow('Not authorized');
    });
});
