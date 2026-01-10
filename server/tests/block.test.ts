/**
 * @file server/tests/block.test.ts
 * @description Test suite for the BlockService.
 *
 * This suite validates block creation, bidirectional verification, match cleanup, and interaction restrictions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../src/services/block.service.js';
import { likeService } from '../src/services/like.service.js';
import { matchService } from '../src/services/match.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * BlockService test suite.
 * Sets up fresh users before each test and validates block behavior.
 */
describe('BlockService', () => {
    let me: any;
    let alice: any;

    /** Initialise a clean database and create two users. */
    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
    });

    /**
     * Block Creation & Verification
     * Scenario: Alice likes Me, allowing Me to block Alice.
     * Expected: The block is recorded and both directions report a block.
     */
    it('should allow blocking a user', async () => {
        await likeService.createLike(alice.id, me.id, true, 'Incoming like from Alice to allow blocking');
        await blockService.blockUser(me.id, alice.id);
        const isBlocked = await blockService.hasBlock(me.id, alice.id);
        expect(isBlocked).toBe(true);
        const isReverseBlocked = await blockService.hasBlock(alice.id, me.id);
        expect(isReverseBlocked).toBe(true);
    });

    /**
     * Match Cleanup on Block
     * Scenario: Alice and Me are matched, then Me blocks Alice.
     * Expected: The match is removed and no longer retrievable.
     */
    it('should remove matches when blocking', async () => {
        const like = await likeService.createLike(alice.id, me.id, true, 'Intro message from Alice > 20 chars');
        await matchService.acceptLike(like.id, 'Reply');
        let matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(1);
        await blockService.blockUser(me.id, alice.id);
        matches = await matchService.getMatches(me.id);
        expect(matches).toHaveLength(0);
    });

    /**
     * Proactive Block Enforcement
     * Scenario: After blocking, any attempt to like the blocked user should fail.
     * Expected: The like operation throws an error indicating interaction is prohibited.
     */
    it('should prevent future interactions', async () => {
        await likeService.createLike(alice.id, me.id, true, 'Incoming like from Alice to allow blocking');
        await blockService.blockUser(me.id, alice.id);
        await expect(
            likeService.createLike(me.id, alice.id, true, 'Try to like blocked user')
        ).rejects.toThrow('Cannot interact with this user');
    });

    /**
     * Blocking Without Prior Interaction
     * Scenario: Attempt to block a user with no incoming like or match.
     * Expected: The block request is rejected with a business rule error.
     */
    it('should prevent blocking users from feed (no prior interaction)', async () => {
        const charlie = await createDummyUser('Charlie');
        await expect(
            blockService.blockUser(me.id, charlie.id)
        ).rejects.toThrow('You can only block users who have liked you or matched with you');
    });
});
