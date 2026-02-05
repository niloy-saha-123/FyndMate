/**
 * @file src/services/match.service.ts
 * @description Manages active connections, chat initiation, and unmatching logic.
 */

import { Prisma, Match } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

// Status constants for type safety (stored as strings in DB)
const LIKE_STATUS = {
    PENDING: 'active',    // DB uses 'active' for pending likes
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
} as const;

const MATCH_STATUS = {
    ACTIVE: 'active',
    UNMATCHED: 'unmatched',
    BLOCKED: 'blocked',
} as const;

type MatchWithUsers = Prisma.MatchGetPayload<{
    include: {
        user1: { select: { id: true; name: true; profilePicture: true } };
        user2: { select: { id: true; name: true; profilePicture: true } };
        messages: true;
    }
}>;

export class MatchService {
    /**
     * Accept a Like and create a Match.
     * 
     * Executes atomically using a transaction with SERIALIZABLE isolation:
     * 1. Locks and verifies the Like record
     * 2. Creates the Match
     * 3. Creates initial messages (intro from liker, reply from accepter)
     * 4. Updates the Like status to ACCEPTED
     */
    async acceptLike(likeId: string, replyMessage?: string): Promise<Match> {
        // Track user IDs for cache invalidation after transaction
        let likerId: string = '';
        let likedId: string = '';

        const match = await prisma.$transaction(async (tx) => {
            // 1. Fetch and verify the like record
            const like = await tx.like.findUnique({
                where: { id: likeId },
                include: {
                    liker: { select: { id: true } },
                    likedUser: { select: { id: true } }
                }
            });

            if (!like) {
                console.warn('Accept attempt on non-existent like', {
                    likeId,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Like not found.");
            }

            if (like.status !== LIKE_STATUS.PENDING) {
                console.warn('Accept attempt on non-pending like', {
                    likeId,
                    status: like.status,
                    timestamp: new Date().toISOString()
                });
                throw new Error("This like has already been processed.");
            }

            // Validate user IDs exist
            if (!like.likerId || !like.likedId || !like.liker?.id || !like.likedUser?.id) {
                console.error('Like record has invalid user IDs', {
                    likeId,
                    likerId: like.likerId,
                    likedId: like.likedId,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Invalid like record.");
            }

            // Extract IDs for later use
            likerId = like.liker.id;
            likedId = like.likedUser.id;
            const introContent = like.message;

            // Sort user IDs for consistent unique constraint
            const [u1, u2] = [likerId, likedId].sort();

            // 2. Check for existing match (prevents race conditions)
            const existingMatch = await tx.match.findUnique({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
            });

            if (existingMatch) {
                if (existingMatch.status === MATCH_STATUS.UNMATCHED) {
                    throw new Error("Cannot re-match with this user.");
                }
                // Already matched - return existing (idempotent)
                return existingMatch;
            }

            // 3. Create the Match
            const newMatch = await tx.match.create({
                data: {
                    user1Id: u1,
                    user2Id: u2,
                    status: MATCH_STATUS.ACTIVE,
                },
            });

            // 4. Create notification preferences for both users
            await tx.matchNotificationPreference.createMany({
                data: [
                    { matchId: newMatch.id, userId: u1, enabled: true },
                    { matchId: newMatch.id, userId: u2, enabled: true },
                ],
            });

            // 5. Create initial messages
            const now = new Date();

            // Message 1: The Liker's Intro
            if (introContent) {
                await tx.message.create({
                    data: {
                        matchId: newMatch.id,
                        senderId: likerId,
                        content: introContent,
                        createdAt: now,
                    },
                });
            }

            // Message 2: The Accepter's Reply
            if (replyMessage && replyMessage.trim().length > 0) {
                await tx.message.create({
                    data: {
                        matchId: newMatch.id,
                        senderId: likedId,
                        content: replyMessage.trim(),
                        createdAt: new Date(now.getTime() + 1),
                    },
                });
            }

            // 6. Update Like status to ACCEPTED
            await tx.like.update({
                where: { id: likeId },
                data: { status: LIKE_STATUS.ACCEPTED },
            });

            return newMatch;
        }, {
            // Use SERIALIZABLE isolation to prevent race conditions
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
        });

        // Cache invalidation AFTER transaction succeeds
        if (likerId && likedId) {
            await Promise.all([
                redis.del(`feed:${likerId}`),
                redis.del(`feed:${likedId}`)
            ]);
        }

        return match;
    }

    /**
     * Unmatch a user.
     * Soft-deletes the match by setting status to UNMATCHED.
     */
    async unmatch(matchId: string, requestingUserId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (!match ||
            match.status === MATCH_STATUS.UNMATCHED ||
            (match.user1Id !== requestingUserId && match.user2Id !== requestingUserId)) {

            console.warn('Unauthorized unmatch attempt', {
                matchId,
                requestingUserId,
                matchExists: !!match,
                matchStatus: match?.status,
                timestamp: new Date().toISOString()
            });

            throw new Error("Not authorized.");
        }

        // Update match status
        return await prisma.match.update({
            where: { id: matchId },
            data: { status: MATCH_STATUS.UNMATCHED }
        });
    }

    /**
     * Block a match.
     * Sets match status to BLOCKED and creates a Block record.
     */
    async blockMatch(matchId: string, blockerId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (!match || (match.user1Id !== blockerId && match.user2Id !== blockerId)) {
            throw new Error("Not authorized.");
        }

        const blockedId = match.user1Id === blockerId ? match.user2Id : match.user1Id;

        return await prisma.$transaction(async (tx) => {
            // Update match status
            await tx.match.update({
                where: { id: matchId },
                data: { status: MATCH_STATUS.BLOCKED }
            });

            // Create block record
            await tx.block.upsert({
                where: { blockerId_blockedId: { blockerId, blockedId } },
                create: {
                    blockerId,
                    blockedId,
                },
                update: {},
            });

            return { success: true };
        });
    }

    /**
     * Get User's Matches (Active connections).
     */
    async getMatches(userId: string): Promise<MatchWithUsers[]> {
        return await prisma.match.findMany({
            where: {
                OR: [
                    { user1Id: userId },
                    { user2Id: userId },
                ],
                status: MATCH_STATUS.ACTIVE,
            },
            include: {
                user1: { select: { id: true, name: true, profilePicture: true } },
                user2: { select: { id: true, name: true, profilePicture: true } },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: {
                createdAt: 'desc',
            }
        });
    }

    /**
     * Get a specific match by ID.
     */
    async getMatch(matchId: string, userId: string) {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                user1: { select: { id: true, name: true, profilePicture: true } },
                user2: { select: { id: true, name: true, profilePicture: true } },
            },
        });

        if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
            throw new Error("Not authorized.");
        }

        return match;
    }
}

export const matchService = new MatchService();

export type { MatchWithUsers };
