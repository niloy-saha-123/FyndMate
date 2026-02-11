/**
 * @file tests/test-utils/factory.ts
 * @description Advanced test factories for common multi-step test scenarios.
 *
 * These factories reduce boilerplate by creating pre-configured data structures
 * (matched pairs, authenticated users, like chains) in a single call.
 */
import { createDummyUser, getAuthToken } from '../helpers.js';
import { likeService } from '../../src/services/like.service.js';
import { matchService } from '../../src/services/match.service.js';
import type { FastifyInstance } from 'fastify';

/**
 * Creates two users who are matched with each other.
 * Steps: create users → user1 likes user2 → user2 accepts → match created.
 */
export async function createMatchedPair(name1 = 'User1', name2 = 'User2') {
    const user1 = await createDummyUser(name1);
    const user2 = await createDummyUser(name2);

    // user1 likes user2
    const like = await likeService.createLike(
        user1.id,
        user2.id,
        true,
        'Test intro message for matching pair',
    );

    // user2 accepts the like → creates match
    const match = await matchService.acceptLike(like.id, 'Test reply message');

    return { user1, user2, like, match };
}

/**
 * Creates a user with a valid auth token for testing authenticated routes.
 * Returns both the database user and a JWT token.
 */
export async function createAuthenticatedUser(app: FastifyInstance, name = 'AuthUser') {
    const user = await createDummyUser(name);
    const authToken = await getAuthToken(user.supabaseId, user.email);
    return { user, authToken };
}

/**
 * Creates a like from one user to another.
 * Shorthand for likeService.createLike with sensible defaults.
 */
export async function createLike(
    likerId: string,
    likedId: string,
    message = 'Default test message for like creation',
) {
    return await likeService.createLike(likerId, likedId, true, message);
}

/**
 * Creates a pass (liked=false) from one user to another.
 */
export async function createPass(likerId: string, likedId: string) {
    return await likeService.createLike(likerId, likedId, false);
}
