/**
 * @file server/tests/block.test.ts
 * @description Test suite for the BlockService.
 *
 * Covers:
 * - Creating Blocks (blocking a user).
 * - Verifying bidirectional block checks (hasBlock).
 * - Removing Matches upon blocking.
 * - Preventing future interactions (Likes) between blocked users.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../src/services/block.service.js';
import { likeService } from '../src/services/like.service.js';
import { matchService } from '../src/services/match.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('BlockService', () => {
    let me: any;
    let alice: any;

    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser("Me");
        alice = await createDummyUser("Alice");
    });

    /**
     * Test: Block Creation & Verification
     * Scenario: User blocks another user.
     * Expected: The block is recorded, and 'hasBlock' returns true for both parties (bidirectional).
     */
    it('should allow blocking a user', async () => {
        // Must interact first (Business Rule: Can't block strangers without interaction?)
        // Let's create a like first to satisfy the requirement
        await likeService.createLike(me.id, alice.id, true, "I am interacting so I can block you...");

        await blockService.blockUser(me.id, alice.id);

        const isBlocked = await blockService.hasBlock(me.id, alice.id);
        expect(isBlocked).toBe(true);

        const isReverseBlocked = await blockService.hasBlock(alice.id, me.id);
        expect(isReverseBlocked).toBe(true); // Bidirectional check
    });

    /**
     * Test: Clean up Matches
     * Scenario: Users are matched. One user blocks the other.
     * Expected: The match is removed (unmatched or deleted) and no longer retrievable.
     */
    it('should remove matches when blocking', async () => {
        // Create match
        const like = await likeService.createLike(alice.id, me.id, true, "Intro message from Alice > 20 chars");
        await matchService.acceptLike(like.id, "Reply");

        // Verify match exists
        let matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(1);

        // Block
        await blockService.blockUser(me.id, alice.id);

        // Verify match gone
        matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(0);

        // Check DB direct status (should be unmatched or blocked?)
        // The service logic might delete it or set status. 
        // Based on block.service.ts, it often sets status to 'unmatched' or deletes?
        // Let's check logic: (Assuming implementation details from previous view)
        // Usually block service calls matchService.unmatch OR hard deletes.
    });

    /**
     * Test: Proactive Block Enforcement
     * Scenario: Users are blocked. One tries to perform an action (Like) on the other.
     * Expected: The action is rejected.
     */
    it('should prevent future interactions', async () => {
        // Interact first to allow block
        await likeService.createLike(me.id, alice.id, true, "I am interacting so I can block you...");
        await blockService.blockUser(me.id, alice.id);

        await expect(
            likeService.createLike(me.id, alice.id, true, "Try to like blocked user")
        ).rejects.toThrow("Cannot interact with this user");
    });
});
