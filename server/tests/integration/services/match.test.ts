/**
 * @file tests/integration/services/match.test.ts
 * @description Integration tests for match service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { matchService } from '../../../src/services/match.service.js';
import { likeService } from '../../../src/services/like.service.js';
import { createDummyUser, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('MatchService', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should create match when accepting like
     */
    it('creates match when accepting like (status active, both user IDs present)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );

        const match = await matchService.acceptLike(like.id);

        expect(match.status).toBe('active');
        expect([match.user1Id, match.user2Id]).toContain(me.id);
        expect([match.user1Id, match.user2Id]).toContain(other.id);
    });

    /**
     * Should create initial messages (intro + reply)
     */
    it('creates initial messages (intro + reply)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );

        const match = await matchService.acceptLike(like.id, 'Hi back!');

        const messages = await prisma.message.findMany({
            where: { matchId: match.id },
            orderBy: { createdAt: 'asc' },
        });

        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe('Hello there!');
        expect(messages[1].content).toBe('Hi back!');
    });

    /**
     * Should retrieve matches correctly - MUST destructure { data, nextCursor }
     */
    it('retrieves matches correctly', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        await matchService.acceptLike(like.id);

        const { data, nextCursor } = await matchService.getMatches(me.id);

        expect(data).toHaveLength(1);
        expect(data[0]).toHaveProperty('user1');
        expect(data[0]).toHaveProperty('user2');
    });

    /**
     * Should allow unmatching (soft delete, status → unmatched)
     */
    it('allows unmatching (soft delete, status → unmatched)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);

        const unmatched = await matchService.unmatch(match.id, me.id);
        expect(unmatched.status).toBe('unmatched');
    });

    /**
     * Should fail to unmatch if not participant
     */
    it('fails to unmatch if not participant', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);

        await expect(
            matchService.unmatch(match.id, third.id)
        ).rejects.toThrow('Not authorized');
    });

    /**
     * Should archive the like after accepting
     */
    it('archives the like after accepting', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );

        await matchService.acceptLike(like.id);

        const updatedLike = await prisma.like.findUnique({
            where: { id: like.id },
        });

        expect(updatedLike?.status).toBe('archived');
    });

    /**
     * Should create notification preferences for both users
     */
    it('creates notification preferences for both users', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);

        const prefs = await prisma.matchNotificationPreference.findMany({
            where: { matchId: match.id },
        });

        expect(prefs).toHaveLength(2);
    });

    /**
     * Should fail to accept non-existent like
     */
    it('fails to accept non-existent like', async () => {
        const fakeId = crypto.randomUUID();

        await expect(matchService.acceptLike(fakeId)).rejects.toThrow(
            'Not authorized'
        );
    });

    /**
     * Should allow re-match after unmatch and hide old-cycle messages
     */
    it('allows re-match after unmatch and resets conversation boundary', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);

        const oldMessage = await prisma.message.create({
            data: {
                matchId: match.id,
                senderId: me.id,
                content: 'Message from old cycle',
            },
        });

        const unmatched = await matchService.unmatch(match.id, me.id);
        expect(unmatched.status).toBe('unmatched');

        const relike = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Want to try again!'
        );

        const rematch = await matchService.acceptLike(relike.id);
        expect(rematch.id).toBe(match.id);
        expect(rematch.status).toBe('active');
        expect(new Date(rematch.conversationStartAt).getTime()).toBeGreaterThanOrEqual(
            new Date(unmatched.conversationStartAt).getTime()
        );

        const relikeAfterAccept = await prisma.like.findUnique({ where: { id: relike.id } });
        expect(relikeAfterAccept?.status).toBe('archived');

        const { data } = await matchService.getMatches(me.id);
        const rematched = data.find((m) => m.id === match.id);
        expect(rematched).toBeTruthy();

        const visibleMessageIds = rematched?.messages.map((msg) => msg.id) ?? [];
        expect(visibleMessageIds).not.toContain(oldMessage.id);
    });

    /**
     * Should fail second unmatch
     */
    it('second unmatch fails', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hello there!'
        );
        const match = await matchService.acceptLike(like.id);
        await matchService.unmatch(match.id, me.id);

        await expect(matchService.unmatch(match.id, me.id)).rejects.toThrow(
            'Not authorized'
        );
    });

    /**
     * Should sort matches by creation date (desc)
     */
    it('sorts matches by creation date (desc)', async () => {
        const me = await createDummyUser('Me');
        const other1 = await createDummyUser('Other1');
        const other2 = await createDummyUser('Other2');

        const like1 = await likeService.createLike(
            other1.id,
            me.id,
            true,
            'Hello from 1!'
        );
        await matchService.acceptLike(like1.id);

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));

        const like2 = await likeService.createLike(
            other2.id,
            me.id,
            true,
            'Hello from 2!'
        );
        await matchService.acceptLike(like2.id);

        const { data } = await matchService.getMatches(me.id);

        expect(data).toHaveLength(2);
        // Most recent match first
        const firstMatchUsers = [data[0].user1.id, data[0].user2.id];
        expect(firstMatchUsers).toContain(other2.id);
    });

    /**
     * Should support cursor pagination in getMatches
     */
    it('supports cursor pagination in getMatches', async () => {
        const me = await createDummyUser('Me');
        const other1 = await createDummyUser('Other1');
        const other2 = await createDummyUser('Other2');

        const like1 = await likeService.createLike(
            other1.id,
            me.id,
            true,
            'Hello from 1!'
        );
        await matchService.acceptLike(like1.id);

        const like2 = await likeService.createLike(
            other2.id,
            me.id,
            true,
            'Hello from 2!'
        );
        const match2 = await matchService.acceptLike(like2.id);

        const { data: page1, nextCursor } = await matchService.getMatches(me.id, 1);
        expect(page1).toHaveLength(1);

        const { data: page2 } = await matchService.getMatches(me.id, 1, nextCursor || undefined);
        expect(page2).toHaveLength(1);
    });
});
