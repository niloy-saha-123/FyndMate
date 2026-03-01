/**
 * @file tests/integration/services/like.test.ts
 * @description Integration tests for like service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../../../src/services/like.service.js';
import { blockService } from '../../../src/services/block.service.js';
import { createDummyUser, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('LikeService', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should allow Like with valid message (>= 10 chars)
     */
    it('allows Like with valid message (>= 10 chars)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const result = await likeService.createLike(
            me.id,
            other.id,
            true,
            'Hello there!'
        );

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('likerId', me.id);
    });

    /**
     * Should fail if message < 10 chars
     */
    it('fails if message < 10 chars', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await expect(
            likeService.createLike(me.id, other.id, true, 'Hi!')
        ).rejects.toThrow('at least 10 characters');
    });

    /**
     * Should fail if liking self
     */
    it('fails if liking self', async () => {
        const me = await createDummyUser('Me');

        await expect(
            likeService.createLike(me.id, me.id, true, 'Hello there!')
        ).rejects.toThrow('Cannot like yourself');
    });

    /**
     * Should fail if blocked
     */
    it('fails if blocked', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        // Create prerequisite: incoming like
        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await blockService.blockUser(me.id, other.id);

        await expect(
            likeService.createLike(me.id, other.id, true, 'Hello there!')
        ).rejects.toThrow('Cannot interact with this user');
    });

    /**
     * Should allow passing (no message)
     */
    it('allows passing (no message)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const result = await likeService.createLike(me.id, other.id, false);

        expect(result).toHaveProperty('liked', false);
    });

    /**
     * Should detect instant match (reciprocal like)
     */
    it('detects instant match (reciprocal like returns Match)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(me.id, other.id, true, 'Hello there!');
        const result = await likeService.createLike(
            other.id,
            me.id,
            true,
            'Hi back there!'
        );

        expect(result).toHaveProperty('user1Id');
        expect(result).toHaveProperty('user2Id');
        expect(result).toHaveProperty('status', 'active');
    });

    /**
     * Should allow second chance (pass → like)
     */
    it('allows second chance (pass → like)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(me.id, other.id, false);
        const result = await likeService.createLike(
            me.id,
            other.id,
            true,
            'Changed my mind!'
        );

        expect(result).toHaveProperty('liked', true);
    });

    /**
     * Should retrieve received likes correctly
     */
    it('retrieves received likes correctly', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');

        const likes = await likeService.getReceivedLikes(me.id);
        expect(likes).toHaveLength(1);
        expect(likes[0].likerId).toBe(other.id);
    });

    /**
     * Should reject likes to non-existent users
     */
    it('rejects likes to non-existent users', async () => {
        const me = await createDummyUser('Me');
        const fakeId = crypto.randomUUID();

        await expect(
            likeService.createLike(me.id, fakeId, true, 'Hello there!')
        ).rejects.toThrow('Cannot interact with this user');
    });

    /**
     * Should reject duplicate likes
     */
    it('rejects duplicate likes', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        await likeService.createLike(me.id, other.id, true, 'Hello there!');

        await expect(
            likeService.createLike(me.id, other.id, true, 'Hello again!')
        ).rejects.toThrow('already liked');
    });

    /**
     * Should sanitize HTML from messages
     */
    it('sanitizes HTML from messages (strips tags)', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const result = await likeService.createLike(
            me.id,
            other.id,
            true,
            '<b>Hello</b> there!'
        );

        const like = await prisma.like.findFirst({
            where: { id: result.id },
        });

        expect(like?.message).not.toContain('<b>');
        expect(like?.message).toContain('Hello');
    });

    /**
     * Should archive a like
     */
    it('archives a like', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');

        const like = await likeService.createLike(
            me.id,
            other.id,
            true,
            'Hello there!'
        );

        const archived = await likeService.archiveLike(like.id);
        expect(archived.status).toBe('archived');
    });

    /**
     * Should filter blocked users from received likes
     */
    it('filters blocked users from received likes', async () => {
        const me = await createDummyUser('Me');
        const other = await createDummyUser('Other');
        const third = await createDummyUser('Third');

        await likeService.createLike(other.id, me.id, true, 'Hello there!');
        await likeService.createLike(third.id, me.id, true, 'Hi from third!');

        await blockService.blockUser(me.id, other.id);

        const likes = await likeService.getReceivedLikes(me.id);
        expect(likes).toHaveLength(1);
        expect(likes[0].likerId).toBe(third.id);
    });
});
