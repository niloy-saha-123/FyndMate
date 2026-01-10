/**
 * @file server/tests/like.test.ts
 * @description Test suite for the LikeService.
 *
 * This suite validates like creation, message validation, self‑like prevention,
 * block enforcement, pass actions, instant match detection, second‑chance logic,
 * and the "Likes You" list.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../src/services/like.service.js';
import { blockService } from '../src/services/block.service.js';
import { prisma } from '../src/lib/prisma.js';
import { createDummyUser, clearDatabase } from './helpers.js';

/**
 * LikeService test suite.
 * Sets up three dummy users before each test.
 */
describe('LikeService', () => {
    let me: any;
    let alice: any;
    let bob: any;

    /** Initialise a clean database and create users. */
    beforeEach(async () => {
        await clearDatabase();
        me = await createDummyUser('Me');
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
    });

    /**
     * Standard Like Creation
     * Scenario: `me` likes `alice` with a valid message.
     * Expected: A Like record is created with status 'active'.
     */
    it('should allow sending a Like with a message', async () => {
        const message = 'Hi Alice! Nice profile picture.'; // >20 chars
        const like = await likeService.createLike(me.id, alice.id, true, message);
        if ('user1Id' in like) {
            throw new Error('Expected Like, got Match');
        }
        expect(like.liked).toBe(true);
        expect(like.likerId).toBe(me.id);
        expect(like.likedId).toBe(alice.id);
        expect(like.message).toBe(message);
        expect(like.status).toBe('active');
        const dbLike = await prisma.like.findFirst({ where: { likerId: me.id, likedId: alice.id } });
        expect(dbLike).toBeDefined();
        expect(dbLike?.message).toBe(message);
        const aliceLikes = await likeService.getReceivedLikes(alice.id);
        expect(aliceLikes).toHaveLength(1);
        expect(aliceLikes[0].likerUser.id).toBe(me.id);
    });

    /**
     * Message Length Validation
     * Scenario: Message shorter than 20 characters.
     * Expected: Validation error is thrown.
     */
    it('should fail if message is too short', async () => {
        await expect(likeService.createLike(me.id, alice.id, true, 'Hi')).rejects.toThrow('Intro message must be at least 20 characters');
    });

    /**
     * Self‑Like Prevention
     * Scenario: `me` attempts to like themselves.
     * Expected: Operation is rejected.
     */
    it('should fail if liking self', async () => {
        await expect(likeService.createLike(me.id, me.id, true, 'Self love')).rejects.toThrow('Cannot like yourself');
    });

    /**
     * Block Enforcement
     * Scenario: `alice` likes `me`, then `me` blocks `alice` and attempts to like again.
     * Expected: Interaction is prohibited.
     */
    it('should fail if user is blocked', async () => {
        await likeService.createLike(alice.id, me.id, true, 'Incoming like from Alice to allow blocking');
        await blockService.blockUser(me.id, alice.id);
        await expect(likeService.createLike(me.id, alice.id, true, 'Blocked message... this is long enough.')).rejects.toThrow('Cannot interact with this user');
    });

    /**
     * Pass Action
     * Scenario: `me` passes `bob`.
     * Expected: A Like record with liked=false and no message is created.
     */
    it('should allow Passing a user (no message needed)', async () => {
        const pass = await likeService.createLike(me.id, bob.id, false);
        if ('user1Id' in pass) {
            throw new Error('Expected a Like object, but got a Match object');
        }
        expect(pass.liked).toBe(false);
        expect(pass.message).toBeNull();
    });

    /**
     * Instant Match Detection
     * Scenario: `bob` likes `me` first, then `me` likes `bob`.
     * Expected: A Match is created with status 'active'.
     */
    it('should detect Instant Match (Reciprocal Like)', async () => {
        await likeService.createLike(bob.id, me.id, true, 'He likes me first.......');
        const result = await likeService.createLike(me.id, bob.id, true, 'I like him back too!....');
        expect(result).toHaveProperty('user1Id');
        expect(result.status).toBe('active');
    });

    /**
     * Second Chance (Pass → Like)
     * Scenario: `me` passes `bob` then decides to like them.
     * Expected: The original Pass record is updated to a Like.
     */
    it('should allow "Second Chance" - changing a Pass to a Like', async () => {
        await likeService.createLike(me.id, bob.id, false);
        const retry = await likeService.createLike(me.id, bob.id, true, 'Changed my mind! This is a long message.');
        if ('user1Id' in retry) {
            throw new Error('Expected Like, got Match');
        }
        expect(retry.liked).toBe(true);
        expect(retry.message).toBe('Changed my mind! This is a long message.');
        expect(retry.status).toBe('active');
    });

    /**
     * "Likes You" List Retrieval
     * Scenario: `alice` and `bob` like `me`; `me` likes `charlie`.
     * Expected: Received likes list contains only `alice` and `bob`.
     */
    it('should retrieve "Received Likes" correctly', async () => {
        await likeService.createLike(alice.id, me.id, true, 'Hey there, would love to connect!');
        await likeService.createLike(bob.id, me.id, true, 'Checking if you want to chat....');
        const charlie = await createDummyUser('Charlie');
        await likeService.createLike(me.id, charlie.id, true, 'I like Charlie.................');
        const received = await likeService.getReceivedLikes(me.id);
        expect(received).toHaveLength(2);
        const names = received.map((l: any) => l.likerUser.name).sort();
        expect(names).toEqual(['Alice', 'Bob']);
    });
});
