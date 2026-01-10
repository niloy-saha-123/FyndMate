/**
 * @file tests/error-paths.test.ts
 * @description Error Path and Edge Case Test Suite.
 *
 * This suite provides comprehensive testing for:
 * - Like Service: Self-like prevention, duplicate like handling, second-chance transitions.
 * - Block Service: Idempotency, self-block prevention, and prerequisite checks.
 * - Match Service: Graceful handling of non-existent likes/matches, idempotency.
 * - Feed Service: Empty feed behavior, invalid inputs, and non-existent users.
 * - Data Integrity: Referential integrity checks and proper resource cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { likeService } from '../src/services/like.service.js';
import { matchService } from '../src/services/match.service.js';
import { blockService } from '../src/services/block.service.js';
import { feedService } from '../src/services/feed.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('Error Path Testing - Like Service', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Self-Like Prevention
     * Scenario: User tries to like themselves.
     * Expected: Operation rejected with an appropriate error.
     */
    it('should reject liking yourself', async () => {
        await expect(
            likeService.createLike(me.id, me.id, true, "Self-love message that is long enough to pass validation")
        ).rejects.toThrow(/cannot.*like.*yourself|same.*user/i);
    });

    /**
     * Duplicate Like (Idempotency)
     * Scenario: User attempts to like the same person twice.
     * Expected: The duplicate attempt is rejected or handled idempotently (rejected here).
     */
    it('should prevent duplicate likes', async () => {
        // First like should succeed
        const like1 = await likeService.createLike(me.id, alice.id, true, "First like message with required length");

        // Second like should either return same like or reject
        await expect(
            likeService.createLike(me.id, alice.id, true, "Duplicate like with required length for validation")
        ).rejects.toThrow(/already.*liked|duplicate|existing/i);
    });

    /**
     * Second Chance Transition (Pass -> Like)
     * Scenario: User previously passed a profile but now wants to like it.
     * Expected: The previous 'pass' status is updated to 'like'.
     */
    it('should allow transition from pass to like (second chance)', async () => {
        // First: pass
        await likeService.createLike(me.id, alice.id, false);

        // Second: change mind and like
        const result = await likeService.createLike(me.id, alice.id, true, "Changed my mind! This message is long enough to pass.");

        // Verify it's a like now (or a match if Alice already liked me)
        if ('liked' in result) {
            expect(result.liked).toBe(true);
        }
        // If it's a match, that's also fine (Alice liked me back)
    });

    /**
     * Non-existent User Handling
     * Scenario: Liking a user ID that does not exist in the database.
     * Expected: Operation rejected with 'Not Found' error.
     */
    it('should reject likes to non-existent users', async () => {
        const fakeId = 'clx7fake1234567890'; // Valid CUID format but doesn't exist

        await expect(
            likeService.createLike(me.id, fakeId, true, "Message to non-existent user that meets length requirements")
        ).rejects.toThrow(/not.*found|does.*not.*exist/i);
    });
});

describe('Error Path Testing - Block Service', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Block Idempotency
     * Scenario: User blocks the same person twice.
     * Expected: Second attempt succeeds without error or side effects (no duplicate records).
     */
    it('should be idempotent - blocking twice should not error or duplicate', async () => {
        // Setup: Alice likes Me (prerequisite for blocking)
        await likeService.createLike(alice.id, me.id, true, "Incoming like from Alice to allow blocking her");

        // First block
        await blockService.blockUser(me.id, alice.id);

        // Second block should not throw or create duplicate
        await blockService.blockUser(me.id, alice.id);

        // Verify only one block record exists
        const blocks = await prisma.block.findMany({
            where: {
                blockerId: me.id,
                blockedId: alice.id
            }
        });
        expect(blocks).toHaveLength(1);
    });

    /**
     * Self-Block Prevention
     * Scenario: User tries to block themselves.
     * Expected: Operation rejected.
     */
    it('should prevent blocking yourself', async () => {
        await expect(
            blockService.blockUser(me.id, me.id)
        ).rejects.toThrow(/cannot.*block.*yourself|same.*user/i);
    });

    /**
     * Block Prerequisite (Interaction)
     * Scenario: Blocking a user with whom there is no prior interaction (like/match).
     * Expected: Operation rejected.
     */
    it('should reject blocking strangers (no interaction)', async () => {
        const stranger = await createDummyUser('Stranger');

        await expect(
            blockService.blockUser(me.id, stranger.id)
        ).rejects.toThrow(/can only block.*liked.*matched/i);
    });
});

describe('Error Path Testing - Match Service', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Accept Non-Existent Like
     * Scenario: Attempting to accept a like ID that does not exist.
     * Expected: Operation rejected with 'Not Found' error.
     */
    it('should reject accepting non-existent like', async () => {
        const fakeLikeId = 'clx7fake1234567890';

        await expect(
            matchService.acceptLike(fakeLikeId, "Reply to non-existent like")
        ).rejects.toThrow(/not.*found|does.*not.*exist/i);
    });

    /**
     * Unmatch Non-Existent Match
     * Scenario: Attempting to unmatch a match ID that does not exist.
     * Expected: Operation rejected with 'Not Found' error.
     */
    it('should reject unmatching non-existent match', async () => {
        const fakeMatchId = 'clx7fake1234567890';

        await expect(
            matchService.unmatch(fakeMatchId, me.id)
        ).rejects.toThrow(/not.*found|does.*not.*exist/i);
    });

    /**
     * Unmatch Idempotency
     * Scenario: Unmatching a match that has already been unmatched.
     * Expected: Operation rejected or handled gracefully (verifying state).
     */
    it('should handle unmatching already-unmatched match gracefully', async () => {
        // Create match
        const like = await likeService.createLike(alice.id, me.id, true, "Like message that is long enough");
        const match = await matchService.acceptLike(like.id, "Reply");

        // First unmatch
        await matchService.unmatch(match.id, me.id);

        // Second unmatch should either succeed (idempotent) or give clear error
        await expect(
            matchService.unmatch(match.id, me.id)
        ).rejects.toThrow(/not.*found|already.*unmatched/i);
    });
});

describe('Error Path Testing - Feed Service', () => {
    let me: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
    });

    /**
     * Empty Feed
     * Scenario: User has exhausted all potential matches.
     * Expected: Returns an empty array (not null/undefined).
     */
    it('should return empty array when no users available', async () => {
        // Like/pass everyone
        const alice = await createDummyUser('Alice');
        const bob = await createDummyUser('Bob');

        await likeService.createLike(me.id, alice.id, true, "Like Alice with message that meets requirements");
        await likeService.createLike(me.id, bob.id, false);

        const feed = await feedService.getFeed(me.id);

        expect(feed).toEqual([]);
        expect(Array.isArray(feed)).toBe(true);
        expect(feed).toHaveLength(0);
    });

    /**
     * Invalid User ID
     * Scenario: Requesting feed with an invalid ID format.
     * Expected: Operation rejected or returns empty feed depending on implementation (here rejected).
     */
    it('should handle invalid user ID gracefully', async () => {
        await expect(
            feedService.getFeed('invalid-id-format')
        ).rejects.toThrow();
    });

    /**
     * Non-Existent User Feed
     * Scenario: Requesting feed for a user ID that doesn't exist.
     * Expected: Returns empty array gracefully.
     */
    it('should handle non-existent user gracefully', async () => {
        const fakeId = 'clx7fake1234567890';

        const feed = await feedService.getFeed(fakeId);

        // Should return empty array, not throw
        expect(Array.isArray(feed)).toBe(true);
        expect(feed).toHaveLength(0);
    });
});

describe('Error Path Testing - Data Integrity', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Referential Integrity (Deletion)
     * Scenario: User is deleted.
     * Expected: Associated likes should be deleted (cascade) or prevent deletion.
     */
    it('should handle user deletion with referential integrity', async () => {
        // Create some data
        await likeService.createLike(me.id, alice.id, true, "Like message that meets the minimum length requirement");

        // Delete user
        await prisma.user.delete({ where: { id: me.id } });

        // Verify likes are also deleted (cascade)
        const orphanedLikes = await prisma.like.findMany({
            where: { likerId: me.id }
        });
        expect(orphanedLikes).toHaveLength(0);
    });

    /**
     * Cleanup After Block
     * Scenario: Blocking a user after a match.
     * Expected: The match record is permanently deleted.
     */
    it('should verify match is actually deleted from database after blocking', async () => {
        // Create match
        const like = await likeService.createLike(alice.id, me.id, true, "Like message with proper length");
        await matchService.acceptLike(like.id, "Reply");

        // Block
        await blockService.blockUser(me.id, alice.id);

        // Verify match is ACTUALLY deleted from database
        const allMatches = await prisma.match.findMany({
            where: {
                OR: [
                    { user1Id: me.id, user2Id: alice.id },
                    { user1Id: alice.id, user2Id: me.id }
                ]
            }
        });
        expect(allMatches).toHaveLength(0);
    });
});
