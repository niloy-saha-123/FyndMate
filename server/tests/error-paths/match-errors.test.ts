/**
 * @file tests/error-paths/match-errors.test.ts
 * @description Error path tests for match operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { matchService } from '../../src/services/match.service.js';
import { likeService } from '../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../helpers.js';

describe('Match Error Paths', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should reject accepting non-existent like
     */
    it('rejects accepting non-existent like', async () => {
        const fakeId = crypto.randomUUID();

        await expect(matchService.acceptLike(fakeId)).rejects.toThrow(
            'Not authorized'
        );
    });

    /**
     * Should reject unmatching non-existent match
     */
    it('rejects unmatching non-existent match', async () => {
        const user = await createDummyUser('User');
        const fakeId = crypto.randomUUID();

        await expect(matchService.unmatch(fakeId, user.id)).rejects.toThrow(
            'Not authorized'
        );
    });

    /**
     * Should handle double-unmatch gracefully
     */
    it('handles double-unmatch gracefully', async () => {
        const user1 = await createDummyUser('User1');
        const user2 = await createDummyUser('User2');

        const like = await likeService.createLike(user1.id, user2.id, true, 'Hello there!');
        const match = await matchService.acceptLike(like.id);

        await matchService.unmatch(match.id, user1.id);

        await expect(matchService.unmatch(match.id, user1.id)).rejects.toThrow(
            'Not authorized'
        );
    });
});
