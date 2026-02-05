/**
 * @file src/services/like.service.ts
 * @description Manages "Like" and "Pass" actions and retrieves the "Likes You" list.
 */

import { Prisma, Like, Match } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { blockService } from './block.service.js';
import { matchService } from './match.service.js';

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

type ReceivedLike = Prisma.LikeGetPayload<{
    include: {
        liker: {
            select: {
                id: true;
                name: true;
                profilePicture: true;
                bio: true;
                skills: true;
            }
        }
    }
}>;

export class LikeService {
    /**
     * Create a Like (or Pass).
     * If reciprocal like exists, automatically creates a match (Hinge-style instant match).
     */
    async createLike(likerId: string, likedId: string, liked: boolean, message?: string): Promise<Like | Match> {
        if (likerId === likedId) {
            throw new Error("Cannot like yourself.");
        }

        // Validate intro message when liking
        if (liked) {
            if (!message || message.trim().length < 20) {
                throw new Error("Intro message must be at least 20 characters.");
            }
            if (message.length > 500) {
                throw new Error("Intro message cannot exceed 500 characters.");
            }
        }

        // Verify target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: likedId },
            select: { id: true }
        });

        if (!targetUser) {
            console.warn('Like attempt on non-existent user', {
                likerId,
                likedId,
                timestamp: new Date().toISOString()
            });
            throw new Error("Cannot interact with this user.");
        }

        // Check for blocks in either direction
        const isBlocked = await blockService.hasBlock(likerId, likedId);
        if (isBlocked) {
            throw new Error("Cannot interact with this user.");
        }

        // Check for existing like
        const existing = await prisma.like.findUnique({
            where: {
                likerId_likedId: { likerId, likedId },
            },
        });

        // Instant Match Check (Hinge-style)
        // If we are liking them, check if they already liked us
        if (liked) {
            const reciprocalLike = await prisma.like.findFirst({
                where: {
                    likerId: likedId,
                    likedId: likerId,
                    status: LIKE_STATUS.PENDING,
                    liked: true
                }
            });

            if (reciprocalLike) {
                // They already liked us - create match immediately
                // The current user's message becomes their reply
                return await matchService.acceptLike(reciprocalLike.id, message);
            }
        }

        if (existing) {
            // Second Chance: Convert Pass to Like
            if (!existing.liked && liked) {
                return await prisma.like.update({
                    where: { id: existing.id },
                    data: { 
                        liked: true, 
                        message, 
                        status: LIKE_STATUS.PENDING, 
                        createdAt: new Date() 
                    },
                });
            }

            if (existing.liked && liked) {
                throw new Error("You have already liked this user.");
            }

            // User is passing on someone they already passed - return existing silently
            return existing;
        }

        // Check for existing active match
        const matchExists = await prisma.match.findFirst({
            where: {
                OR: [
                    { user1Id: likerId, user2Id: likedId },
                    { user1Id: likedId, user2Id: likerId }
                ],
                status: MATCH_STATUS.ACTIVE
            }
        });

        if (matchExists) {
            throw new Error("You are already matched with this user.");
        }

        // Create new like/pass
        const result = await prisma.like.create({
            data: {
                likerId,
                likedId,
                liked,
                message: liked ? message : null,
                status: LIKE_STATUS.PENDING,
            },
        });

        // Invalidate Feed Cache for both users
        await Promise.all([
            redis.del(`feed:${likerId}`),
            redis.del(`feed:${likedId}`)
        ]);

        return result;
    }

    /**
     * Get pending "Likes You" list.
     * Filters out blocked users.
     */
    async getReceivedLikes(userId: string, limit = 20, cursor?: string): Promise<ReceivedLike[]> {
        const [likes, blocks] = await Promise.all([
            prisma.like.findMany({
                take: limit,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                where: {
                    likedId: userId,
                    liked: true,
                    status: LIKE_STATUS.PENDING,
                },
                include: {
                    liker: {
                        select: {
                            id: true,
                            name: true,
                            profilePicture: true,
                            bio: true,
                            skills: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            prisma.block.findMany({
                where: {
                    OR: [
                        { blockerId: userId },
                        { blockedId: userId }
                    ]
                },
                select: { blockerId: true, blockedId: true }
            })
        ]);

        const blockedIds = new Set<string>();
        blocks.forEach(b => {
            blockedIds.add(b.blockerId);
            blockedIds.add(b.blockedId);
        });

        return likes.filter(like => !blockedIds.has(like.liker.id));
    }

    /**
     * Get a specific like by ID with user details.
     */
    async getLike(likeId: string) {
        return await prisma.like.findUnique({
            where: { id: likeId },
            include: { liker: true, likedUser: true }
        });
    }

    /**
     * Decline a like.
     */
    async declineLike(likeId: string) {
        return await prisma.like.update({
            where: { id: likeId },
            data: { status: LIKE_STATUS.DECLINED }
        });
    }
}

export const likeService = new LikeService();

export type { ReceivedLike };
