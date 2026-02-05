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
        let outerLikerId: string = '';
        let outerLikedId: string = '';

        const match = await prisma.$transaction(async (tx) => {
            const like = await tx.like.findUnique({
                where: { id: likeId }
            });

            console.log('DEBUG: Like record fetched:', JSON.stringify(like, null, 2));

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

            // Validate that the like has valid user IDs
            if (!like.likerId || !like.likedId) {
                console.error('Like record has null user IDs', {
                    likeId,
                    likerId: like.likerId,
                    likedId: like.likedId,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Invalid like record.");
            }

            // Use local constants inside the transaction to avoid closure issues
            const likerId = like.likerId;
            const likedId = like.likedId;
            const introContent = like.message;

            // Set outer variables for cache invalidation after transaction
            outerLikerId = likerId;
            outerLikedId = likedId;

            console.log('DEBUG: Extracted IDs - likerId:', likerId, 'likedId:', likedId);

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

            // 3. Create Notification Preferences for both users
            await tx.matchNotificationPreference.create({
                data: {
                    matchId: newMatch.id,
                    userId: u1,
                    enabled: true,
                },
            });

            await tx.matchNotificationPreference.create({
                data: {
                    matchId: newMatch.id,
                    userId: u2,
                    enabled: true,
                },
            });

            // 4. Create Initial Messages
            // Message 1: The Liker's Intro (User B)
            const now = new Date();
            
            console.log('DEBUG BEFORE MESSAGE CREATE:');
            console.log('  likerId:', likerId, 'type:', typeof likerId);
            console.log('  likedId:', likedId, 'type:', typeof likedId);
            console.log('  introContent:', introContent);
            console.log('  newMatch.id:', newMatch.id);
            
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

            // 4. Archive Like
            await tx.like.update({
                where: { id: likeId },
                data: { status: 'archived' },
            });

            return newMatch;
        });

        // Cache invalidation AFTER transaction succeeds (prevents inconsistency on rollback)
        await Promise.all([
            redis.del(`feed:${outerLikerId}`),
            redis.del(`feed:${outerLikedId}`)
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
