/**
 * @file src/services/match.service.ts
 * @description Manages active connections, chat initiation, and unmatching logic.
 */

import { Prisma, Match } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

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
     * Executes atomically using a transaction:
     * 1. Verifies/Locks the Like
     * 2. Creates the Match
     * 3. Creates initial messages (Intro + Reply)
     * 4. Archives the original Like
     */
    async acceptLike(likeId: string, replyMessage?: string): Promise<Match> {
        // Extract user IDs for cache invalidation after transaction completes
        let likerId: string;
        let likedId: string;

        const match = await prisma.$transaction(async (tx) => {
            const like = await tx.like.findUnique({
                where: { id: likeId }
            });

            if (!like) {
                console.warn('Accept attempt on non-existent like', {
                    likeId,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Not authorized.");
            }

            if (like.status !== 'active') {
                console.warn('Accept attempt on inactive like', {
                    likeId,
                    status: like.status,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Not authorized.");
            }

            likerId = String(like.likerId);
            likedId = String(like.likedId);
            const introContent = like.message;

            const [u1, u2] = [likerId, likedId].sort();

            const existingMatch = await tx.match.findUnique({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
            });

            if (existingMatch) {
                if (existingMatch.status === 'unmatched') {
                    throw new Error("Cannot re-match with this user.");
                }
                return existingMatch;
            }

            const newMatch = await tx.match.create({
                data: {
                    user1Id: u1,
                    user2Id: u2,
                    status: 'active',
                },
            });

            // Create Intro Message (from Liker)
            const now = new Date();
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

            // Create Reply Message (from Accepter)
            if (replyMessage && replyMessage.trim().length > 0) {
                await tx.message.create({
                    data: {
                        matchId: newMatch.id,
                        senderId: likedId,
                        content: replyMessage,
                        createdAt: new Date(now.getTime() + 1), // Ensure chronological order
                    }
                });
            }

            await tx.like.update({
                where: { id: likeId },
                data: { status: 'archived' },
            });

            return newMatch;
        });

        // Cache invalidation AFTER transaction succeeds (prevents inconsistency on rollback)
        await Promise.all([
            redis.del(`feed:${likerId!}`),
            redis.del(`feed:${likedId!}`)
        ]);

        return match;
    }

    /**
     * Unmatch a user.
     * Soft-deletes the match by setting status to 'unmatched'.
     */
    async unmatch(matchId: string, requestingUserId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (!match ||
            match.status === 'unmatched' ||
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

        return await prisma.match.update({
            where: { id: matchId },
            data: { status: 'unmatched' }
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
                status: 'active',
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
}

export const matchService = new MatchService();

export type { MatchWithUsers };
