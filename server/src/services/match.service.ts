/**
 * @file src/services/match.service.ts
 * @description Manages active connections, chat initiation, and unmatching logic.
 */

import { Prisma, Match } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { publicUserMatchSelect } from '../utils/publicUser.js';
import { sanitizeText } from '../utils/sanitizeText.js';
import { filterLocationByPrivacy } from '../utils/locationPrivacy.js';
import { signProfilePicture } from '../utils/profilePicture.js';
import { computeAge } from '../utils/computeAge.js';

type MatchWithUsers = Prisma.MatchGetPayload<{
    include: {
        user1: { select: typeof publicUserMatchSelect };
        user2: { select: typeof publicUserMatchSelect };
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
            // Fetch like WITH the liker user to ensure we have valid IDs
            const like = await tx.like.findUnique({
                where: { id: likeId },
                include: {
                    likerUser: { select: { id: true } },
                    likedUser: { select: { id: true } }
                }
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
            if (!like.likerId || !like.likedId || !like.likerUser?.id || !like.likedUser?.id) {
                console.error('Like record has null user IDs', {
                    likeId,
                    likerId: like.likerId,
                    likedId: like.likedId,
                    likerUserId: like.likerUser?.id,
                    likedUserId: like.likedUser?.id,
                    timestamp: new Date().toISOString()
                });
                throw new Error("Invalid like record.");
            }

            // Use the related user IDs to ensure they exist in the User table
            const likerId = like.likerUser.id;
            const likedId = like.likedUser.id;
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
            
            // Create Intro Message (from Liker)
            if (introContent && likerId) {
                console.log('Creating intro message with senderId:', likerId);
                await tx.message.create({
                    data: {
                        match: { connect: { id: newMatch.id } },
                        sender: { connect: { id: likerId } },
                        content: introContent,
                        createdAt: now,
                    }
                });
            }

            // Create Reply Message (from Accepter)
            if (replyMessage && replyMessage.trim().length > 0 && likedId) {
                const sanitizedReply = sanitizeText(replyMessage);
                if (sanitizedReply.length > 0) {
                console.log('Creating reply message with senderId:', likedId);
                await tx.message.create({
                    data: {
                        match: { connect: { id: newMatch.id } },
                        sender: { connect: { id: likedId } },
                        content: sanitizedReply,
                        createdAt: new Date(now.getTime() + 1),
                    }
                });
                }
            }

            // 4. Archive Like
            await tx.like.update({
                where: { id: likeId },
                data: { status: 'archived' },
            });

            return newMatch;
        });

        // Cache invalidation AFTER transaction succeeds (prevents inconsistency on rollback)
        // Non-critical: If Redis is down, caches will just stay stale for 5 minutes
        await Promise.all([
            redis.del(`feed:${outerLikerId}`),
            redis.del(`feed:${outerLikedId}`)
        ]).catch(err => {
            console.warn('Cache invalidation failed (non-critical):', err.message);
            // Not throwing - match was created successfully, cache will expire naturally
        });

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
    async getMatches(userId: string, limit = 20, cursor?: string): Promise<{ data: MatchWithUsers[]; nextCursor: string | null }> {
        const matches = await prisma.match.findMany({
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            where: {
                OR: [
                    { user1Id: userId },
                    { user2Id: userId },
                ],
                status: 'active',
            },
            include: {
                user1: { select: { ...publicUserMatchSelect, birthDate: true, city: true, country: true, locationSharing: true } },
                user2: { select: { ...publicUserMatchSelect, birthDate: true, city: true, country: true, locationSharing: true } },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, content: true, senderId: true, createdAt: true, readAt: true }, // TODO [POST-MVP]: Implement proper read receipts and unread counts server-side.
                }
            },
            orderBy: {
                createdAt: 'desc',
            }
        });

        const transformed = await Promise.all(matches.map(async (m: any) => {
            const age1 = computeAge(m.user1.birthDate as any);
            const age2 = computeAge(m.user2.birthDate as any);
            const sanitizedUser1 = filterLocationByPrivacy(m.user1);
            const sanitizedUser2 = filterLocationByPrivacy(m.user2);
            const { birthDate: _b1, city: _c1, country: _ct1, ...u1 } = sanitizedUser1 as any;
            const { birthDate: _b2, city: _c2, country: _ct2, ...u2 } = sanitizedUser2 as any;

            // Sign both profile pictures in parallel instead of sequentially
            const [pic1, pic2] = await Promise.all([
                signProfilePicture(u1.profilePicture),
                signProfilePicture(u2.profilePicture),
            ]);

            return {
                ...m,
                user1: { ...u1, profilePicture: pic1, age: age1 },
                user2: { ...u2, profilePicture: pic2, age: age2 },
            };
        }));

        const nextCursor = matches.length === limit ? matches[matches.length - 1].id : null;
        return { data: transformed, nextCursor };
    }

    /**
     * Get match status (status, blockedBy) for a participant.
     */
    async getMatchStatus(matchId: string, userId: string): Promise<{ status: string; blockedBy: string | null }> {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: { status: true, blockedBy: true, user1Id: true, user2Id: true },
        });

        if (
            !match ||
            (match.user1Id !== userId && match.user2Id !== userId)
        ) {
            throw new Error('Not authorized');
        }

        return { status: match.status, blockedBy: match.blockedBy };
    }

    /**
     * Block a match (set status to 'blocked', blockedBy to requesting user).
     * Only participants can block.
     */
    async blockMatch(matchId: string, userId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (
            !match ||
            match.status === 'unmatched' ||
            (match.user1Id !== userId && match.user2Id !== userId)
        ) {
            throw new Error('Not authorized');
        }

        return prisma.match.update({
            where: { id: matchId },
            data: { status: 'blocked', blockedBy: userId },
        });
    }

    /**
     * Unblock a match. Only the user who blocked can unblock.
     */
    async unblockMatch(matchId: string, userId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (!match) {
            throw new Error('Match not found');
        }
        if (match.blockedBy !== userId) {
            throw new Error('Not authorized');
        }

        return prisma.match.update({
            where: { id: matchId },
            data: { status: 'active', blockedBy: null },
        });
    }

    /**
     * Hide a match from the requesting user's chat list.
     * Only participants can hide.
     */
    async hideMatch(matchId: string, userId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });

        if (
            !match ||
            (match.user1Id !== userId && match.user2Id !== userId)
        ) {
            throw new Error('Not authorized');
        }

        return prisma.match.update({
            where: { id: matchId },
            data: { status: 'hidden' },
        });
    }
}

export const matchService = new MatchService();

export type { MatchWithUsers };
