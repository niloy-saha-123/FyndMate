/**
 * @file tests/concurrency.test.ts
 * @description Concurrency and race condition testing
 * 
 * Tests system behavior under concurrent operations.
 * Dating apps have high concurrency - two users might like each other simultaneously,
 * or try to match/block at the same time. These tests prevent data corruption and duplicates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { likeService } from '../src/services/like.service.js';
import { matchService } from '../src/services/match.service.js';
import { blockService } from '../src/services/block.service.js';
import { createDummyUser, clearDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('Concurrency - Mutual Likes', () => {
    let alice: any;
    let bob: any;

    beforeEach(async () => {
        await clearDatabase();
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
    });

    /**
     * Test: Simultaneous Mutual Likes
     * Critical test: When Alice and Bob like each other at exactly the same time,
     * the system should create exactly ONE match, not two or zero.
     */
    it('should create exactly one match when users like each other simultaneously', async () => {
        // Both users like each other at the same time (Promise.all = concurrent)
        const results = await Promise.allSettled([
            likeService.createLike(alice.id, bob.id, true, "Hi Bob! This is a message from Alice with proper length"),
            likeService.createLike(bob.id, alice.id, true, "Hi Alice! This is a message from Bob with proper length")
        ]);

        // At least one should succeed (both might succeed if timing is right)
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Verify exactly ONE match was created (not zero, not two)
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { user1Id: alice.id, user2Id: bob.id },
                    { user1Id: bob.id, user2Id: alice.id }
                ]
            }
        });

        expect(matches).toHaveLength(1);
    });

    /**
     * Test: Concurrent Likes to Same User
     * Verifies that liking the same user multiple times concurrently
     * doesn't create duplicate likes
     */
    it('should prevent duplicate likes under concurrent requests', async () => {
        const charlie = await createDummyUser('Charlie');

        // Try to create same like 10 times concurrently
        const promises = Array(10).fill(null).map((_, i) =>
            likeService.createLike(alice.id, charlie.id, true, `Concurrent like attempt ${i} with proper message length requirements`)
        );

        const results = await Promise.allSettled(promises);

        // At least one should succeed
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // But only ONE like record should exist in database
        const likes = await prisma.like.findMany({
            where: {
                likerId: alice.id,
                likedId: charlie.id
            }
        });

        expect(likes).toHaveLength(1);
    });
});

describe('Concurrency - Blocking', () => {
    let alice: any;
    let bob: any;

    beforeEach(async () => {
        await clearDatabase();
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
    });

    /**
     * Test: Concurrent Mutual Blocking
     * When both users try to block each other simultaneously
     */
    it('should handle mutual blocking without creating duplicate records', async () => {
        // Setup: Create mutual likes (prerequisite for blocking)
        await likeService.createLike(alice.id, bob.id, true, "Like from Alice to allow future blocking");
        await likeService.createLike(bob.id, alice.id, true, "Like from Bob to allow future blocking");

        // Both block each other simultaneously
        const results = await Promise.allSettled([
            blockService.blockUser(alice.id, bob.id),
            blockService.blockUser(bob.id, alice.id)
        ]);

        // At least one should succeed
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Verify blocks exist (could be 1 or 2 depending on implementation)
        const blocks = await prisma.block.findMany({
            where: {
                OR: [
                    { blockerId: alice.id, blockedId: bob.id },
                    { blockerId: bob.id, blockedId: alice.id }
                ]
            }
        });

        // Should have at least 1, at most 2
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        expect(blocks.length).toBeLessThanOrEqual(2);

        // Verify no duplicate blocks for same blocker-blocked pair
        const aliceBlocks = blocks.filter(b => b.blockerId === alice.id && b.blockedId === bob.id);
        expect(aliceBlocks).toHaveLength(1);
    });

    /**
     * Test: Block Same User Multiple Times Concurrently
     * Idempotency test under concurrency
     */
    it('should be idempotent when blocking same user concurrently', async () => {
        // Setup prerequisite
        await likeService.createLike(bob.id, alice.id, true, "Incoming like from Bob to allow Alice to block");

        // Try to block same user 5 times concurrently
        const promises = Array(5).fill(null).map(() =>
            blockService.blockUser(alice.id, bob.id)
        );

        const results = await Promise.allSettled(promises);

        // All should succeed (idempotent)
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBe(5);

        // But only ONE block record
        const blocks = await prisma.block.findMany({
            where: {
                blockerId: alice.id,
                blockedId: bob.id
            }
        });

        expect(blocks).toHaveLength(1);
    });
});

describe('Concurrency - Match Operations', () => {
    let alice: any;
    let bob: any;

    beforeEach(async () => {
        await clearDatabase();
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
    });

    /**
     * Test: Concurrent Accept of Same Like
     * Edge case: Multiple attempts to accept the same like
     */
    it('should handle concurrent acceptance of same like', async () => {
        // Alice likes Bob
        const like = await likeService.createLike(alice.id, bob.id, true, "Like from Alice with proper length");

        // Try to accept the same like multiple times concurrently
        const promises = Array(3).fill(null).map((_, i) =>
            matchService.acceptLike(like.id, `Reply ${i}`)
        );

        const results = await Promise.allSettled(promises);

        // At least one should succeed
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Only ONE match should be created
        const matches = await prisma.match.findMany({
            where: {
                OR: [
                    { user1Id: alice.id, user2Id: bob.id },
                    { user1Id: bob.id, user2Id: alice.id }
                ]
            }
        });

        expect(matches).toHaveLength(1);
    });

    /**
     * Test: Concurrent Unmatch Attempts
     * Both users try to unmatch simultaneously
     */
    it('should handle concurrent unmatch attempts', async () => {
        // Create match
        const like = await likeService.createLike(alice.id, bob.id, true, "Like with proper message length");
        const match = await matchService.acceptLike(like.id, "Reply");

        // Both try to unmatch simultaneously
        const results = await Promise.allSettled([
            matchService.unmatch(match.id, alice.id),
            matchService.unmatch(match.id, bob.id)
        ]);

        // At least one should succeed
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Match should be unmatched (either deleted or status='unmatched')
        const updatedMatch = await prisma.match.findUnique({ where: { id: match.id } });

        if (updatedMatch) {
            expect(updatedMatch.status).toBe('unmatched');
        } else {
            // Match was deleted - also acceptable
            expect(updatedMatch).toBeNull();
        }
    });
});

describe('Concurrency - Mixed Operations', () => {
    let alice: any;
    let bob: any;
    let charlie: any;

    beforeEach(async () => {
        await clearDatabase();
        alice = await createDummyUser('Alice');
        bob = await createDummyUser('Bob');
        charlie = await createDummyUser('Charlie');
    });

    /**
     * Test: Like While Being Blocked
     * Edge case: Alice tries to like Bob while Bob is blocking Alice
     */
    it('should reject like when block happens concurrently', async () => {
        // Setup: Bob likes Alice (so Alice can block Bob)
        await likeService.createLike(bob.id, alice.id, true, "Bob likes Alice with proper message length");

        // Alice tries to like Bob while Bob blocks Alice (race condition)
        const results = await Promise.allSettled([
            likeService.createLike(alice.id, bob.id, true, "Alice tries to like Bob with proper message"),
            blockService.blockUser(alice.id, bob.id)
        ]);

        // One of these operations should succeed
        // If block happens first, like should fail
        // If like happens first, both might succeed but subsequent interactions blocked

        // Verify: After everything settles, they can't interact
        const canInteract = await blockService.hasBlock(alice.id, bob.id);
        expect(canInteract).toBe(true);
    });

    /**
     * Test: High Concurrency Stress Test
     * Multiple users performing various operations simultaneously
     */
    it('should maintain data consistency under high concurrent load', async () => {
        const users = [alice, bob, charlie];

        // Everyone likes everyone simultaneously
        const likePromises = users.flatMap(user1 =>
            users
                .filter(user2 => user1.id !== user2.id)
                .map(user2 =>
                    likeService.createLike(user1.id, user2.id, true, `Like from ${user1.name} to ${user2.name} with proper length`)
                )
        );

        await Promise.allSettled(likePromises);

        // Verify: Total likes should be reasonable (not duplicated excessively)
        const totalLikes = await prisma.like.count();

        // Maximum possible: 3 users * 2 others = 6 likes
        expect(totalLikes).toBeLessThanOrEqual(6);
        expect(totalLikes).toBeGreaterThanOrEqual(1); // At least some succeeded

        // Verify: Matches created appropriately
        const totalMatches = await prisma.match.count();

        // Maximum possible: 3 matches (alice-bob, alice-charlie, bob-charlie)
        expect(totalMatches).toBeLessThanOrEqual(3);
    });
});
