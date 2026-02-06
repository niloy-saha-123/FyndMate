/**
 * @file src/services/like.service.ts
 * @description Manages "Like" and "Pass" actions and retrieves the "Likes You" list.
 */

import { Prisma, Like, Match } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { blockService } from './block.service.js';
import { matchService } from './match.service.js';
import { publicUserLikeSelect } from '../utils/publicUser.js';
import { sanitizeText } from '../utils/sanitizeText.js';

type ReceivedLike = Prisma.LikeGetPayload<{
    include: {
        likerUser: {
            select: typeof publicUserLikeSelect;
        }
    }
}>;

export class LikeService {
    /**
     * Create a Like (or Pass).
     */
    async createLike(likerId: string, likedId: string, liked: boolean, message?: string): Promise<Like | Match> {
        if (likerId === likedId) {
            throw new Error("Cannot like yourself.");
        }

        if (liked) {
            const sanitizedMessage = message ? sanitizeText(message) : '';
            if (!sanitizedMessage || sanitizedMessage.length < 20) {
                throw new Error("Intro message must be at least 20 characters.");
            }
            if (sanitizedMessage.length > 500) {
                throw new Error("Intro message cannot exceed 500 characters.");
            }
            message = sanitizedMessage;
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

            // Prevent user enumeration
            throw new Error("Cannot interact with this user.");
        }

        const isBlocked = await blockService.hasBlock(likerId, likedId);
        if (isBlocked) {
            throw new Error("Cannot interact with this user.");
        }

        const existing = await prisma.like.findUnique({
            where: {
                likerId_likedId: { likerId, likedId },
            },
        });

        // Instant Match Check (Hinge-style)
        // If we are liking them, check if they already liked us.
        if (liked) {
            const reciprocalLike = await prisma.like.findFirst({
                where: {
                    likerId: likedId,
                    likedId: likerId,
                    status: 'active',
                    liked: true
                }
            });

            if (reciprocalLike) {
                return await matchService.acceptLike(reciprocalLike.id, message);
            }
        }

        if (existing) {
            // Second Chance: Convert Pass to Like
            if (!existing.liked && liked) {
                return await prisma.like.update({
                    where: { id: existing.id },
                    data: { liked: true, message, status: 'active', createdAt: new Date() },
                });
            }

            if (existing.liked && liked) {
                throw new Error("You have already liked this user.");
            }

            // User is passing on someone they already passed - just return existing silently
            // This can happen if feed shows a previously passed user again
            return existing;
        }

        const matchExists = await prisma.match.findFirst({
            where: {
                OR: [
                    { user1Id: likerId, user2Id: likedId },
                    { user1Id: likedId, user2Id: likerId }
                ],
                status: 'active'
            }
        });

        if (matchExists) {
            throw new Error("You are already matched with this user.");
        }

            const result = await prisma.like.create({
            data: {
                likerId,
                likedId,
                liked,
                message: liked ? message : null,
                status: 'active',
            },
        });

        // Invalidate Feed Cache for both users
        // Non-critical: If Redis is down, caches will just stay stale for 5 minutes
        await Promise.all([
            redis.del(`feed:${likerId}`),
            redis.del(`feed:${likedId}`)
        ]).catch(err => {
            console.warn('Cache invalidation failed (non-critical):', err.message);
            // Not throwing - like was created successfully, cache will expire naturally
        });

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
                    status: 'active',
                },
                include: {
                    likerUser: {
                        select: publicUserLikeSelect,
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

        return likes.filter(like => !blockedIds.has(like.likerUser.id));
    }

    async getLike(likeId: string) {
        return await prisma.like.findUnique({
            where: { id: likeId },
            include: { likerUser: true, likedUser: true }
        });
    }

    async archiveLike(likeId: string) {
        return await prisma.like.update({
            where: { id: likeId },
            data: { status: 'archived' }
        });
    }
}

export const likeService = new LikeService();

export type { ReceivedLike };
