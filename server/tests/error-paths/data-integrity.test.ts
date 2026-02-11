/**
 * @file tests/error-paths/data-integrity.test.ts
 * @description Error path tests for data integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { blockService } from '../../src/services/block.service.js';
import { likeService } from '../../src/services/like.service.js';
import { matchService } from '../../src/services/match.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Data Integrity', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should cascade delete likes when user is deleted
     */
    it('user deletion cascades likes', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');

        // Delete user1
        await prisma.user.delete({ where: { id: user1.id } });

        // Like should be cascade deleted
        const likeAfterDelete = await prisma.like.findUnique({
            where: { id: like.id },
        });

        expect(likeAfterDelete).toBeNull();
    });

    /**
     * Should delete match from database when blocking
     */
    it('blocking deletes match from database', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);

        await blockService.blockUser(user1.id, user2.id);

        const matchAfterBlock = await prisma.match.findUnique({
            where: { id: match.id },
        });

        expect(matchAfterBlock).toBeNull();
    });
});
