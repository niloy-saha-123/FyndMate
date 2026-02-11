/**
 * @file tests/integration/services/block.test.ts
 * @description Integration tests for block service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../../../src/services/block.service.js';
import { likeService } from '../../../src/services/like.service.js';
import { matchService } from '../../../src/services/match.service.js';
import { createDummyUser, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('BlockService', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should allow blocking (with incoming like prerequisite)
     */
    it('allows blocking (with incoming like prerequisite)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        const block = await blockService.blockUser(me.id, other.id);

        expect(block).toHaveProperty('blockerId', me.id);
        expect(block).toHaveProperty('blockedId', other.id);
    });

    /**
     * Should provide bidirectional detection (hasBlock returns true both ways)
     */
    it('bidirectional detection (hasBlock returns true both ways)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await blockService.blockUser(me.id, other.id);

        const forwardBlock = await blockService.hasBlock(me.id, other.id);
        const reverseBlock = await blockService.hasBlock(other.id, me.id);

        expect(forwardBlock).toBe(true);
        expect(reverseBlock).toBe(true);
    });

    /**
     * Should remove matches when blocking
     */
    it('removes matches when blocking', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        // Create match
        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);

        await blockService.blockUser(me.id, other.id);

        const matchAfterBlock = await prisma.match.findUnique({
            where: { id: match.id },
        });

        expect(matchAfterBlock).toBeNull();
    });

    /**
     * Should prevent future interactions
     */
    it('prevents future interactions', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await blockService.blockUser(me.id, other.id);

        await expect(
            likeService.createLike(me.id, other.id, true, 'Trying to like!')
        ).rejects.toThrow('Cannot interact with this user');
    });

    /**
     * Should prevent blocking strangers (no interaction)
     */
    it('prevents blocking strangers (no interaction)', async () => {
        const me = await createDummyUser('Me');
        const stranger = await createDummyUser('Stranger');

        await expect(
            blockService.blockUser(me.id, stranger.id)
        ).rejects.toThrow('can only block users who have liked you or matched');
    });

    /**
     * Should prevent blocking yourself
     */
    it('prevents blocking yourself', async () => {
        const me = await createDummyUser('Me');

        await expect(blockService.blockUser(me.id, me.id)).rejects.toThrow(
            'Cannot block yourself'
        );
    });

    /**
     * Should be idempotent (second block returns existing, no error)
     */
    it('idempotent (second block returns existing, no error)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        const block1 = await blockService.blockUser(me.id, other.id);
        const block2 = await blockService.blockUser(me.id, other.id);

        expect(block1.id).toBe(block2.id);
    });

    /**
     * Should archive likes when blocking
     */
    it('archives likes when blocking', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );

        await blockService.blockUser(me.id, other.id);

        const likeAfterBlock = await prisma.like.findUnique({
            where: { id: like.id },
        });

        expect(likeAfterBlock?.status).toBe('archived');
    });

    /**
     * Should allow unblocking
     */
    it('allows unblocking', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await blockService.blockUser(me.id, other.id);

        const unblocked = await blockService.unblockUser(me.id, other.id);
        expect(unblocked).toHaveProperty('blockerId', me.id);

        const hasBlockAfter = await blockService.hasBlock(me.id, other.id);
        expect(hasBlockAfter).toBe(false);
    });
});
