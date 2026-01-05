/**
 * @file src/services/like.service.ts
 * @description Manages the "Like" and "Pass" ACTIONS and the "Likes Section" VIEW.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Create Like: Handles the logic when a user Swipes Right.
 *    - Validates Message Length (Min 20 chars for Intro).
 *    - Checks for Blocks or Self-Likes.
 * 2. Hinge-Style Likes Section: Fetches the "Likes You" list.
 *    - This is NOT the Matches/Inbox. It's the list of pending likes waiting for response.
 *    - Filters out people who blocked you (safety).
 * 
 * Used by: matching.routes.ts
 */
import { prisma } from '../lib/prisma.js';
import { blockService } from './block.service.js';
import { matchService } from './match.service.js';

export class LikeService {
    /**
     * Create a Like (or Pass).
     * @param likerId The actor
     * @param likedId The target target
     * @param liked true = LIKE, false = PASS
     * @param message Optional message (Required if liked=true)
     */
    async createLike(likerId: string, likedId: string, liked: boolean, message?: string) {
        // 1. Validation: Self-Like
        if (likerId === likedId) {
            throw new Error("Cannot like yourself.");
        }

        // 2. Validation: Message Requirements
        if (liked) {
            if (!message || message.trim().length < 20) {
                throw new Error("Intro message must be at least 20 characters.");
            }
            if (message.length > 500) {
                throw new Error("Intro message cannot exceed 500 characters.");
            }
        }

        // 3. Validation: Block Check
        const isBlocked = await blockService.hasBlock(likerId, likedId);
        if (isBlocked) {
            throw new Error("Cannot interact with this user.");
        }

        // 4. Validation: Check for existing interactions to prevent unique constraint errors
        // If we already passed/liked them, we check specifically.
        // However, Plan Edge Case #54 says "Retry a like (not pass) -> Only allow retry on liked=false".
        // For now, let's just use upsert or check-then-create.
        // The schema has @@unique([likerId, likedId]).

        // Check if interaction exists
        const existing = await prisma.like.findUnique({
            where: {
                likerId_likedId: { likerId, likedId },
            },
        });

        if (existing) {
            // ... existing checks ...
        }

        // HINGE-STYLE "INSTANT MATCH" CHECK
        // If we are LIKING them (liked: true), check if they ALREADY liked us.
        // This must run even on "Second Chance" likes (updating an existing Pass).
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
                // They liked us first! Immediate Match.
                return await matchService.acceptLike(reciprocalLike.id, message);
            }
        }

        if (existing) {
            // If it was a PASS (liked: false) and we are now LIKING (liked: true) -> Update (Second Chance)
            if (!existing.liked && liked) {
                return await prisma.like.update({
                    where: { id: existing.id },
                    data: { liked: true, message, status: 'active', createdAt: new Date() },
                });
            }
            // Otherwise, idempotent return or error
            if (existing.liked === liked) return existing;

            throw new Error("Interaction already exists.");
        }

        // 5. Check if they are already matched?
        // If they are matched, we shouldn't be creating a like.
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

        // 6. Create the Like/Pass
        return await prisma.like.create({
            data: {
                likerId,
                likedId,
                liked,
                message: liked ? message : null, // Clear message if pass
                status: 'active',
            },
        });
    }

    /**
     * Get Received Likes specific to the "Likes Section".
     * Logic: Users who liked ME, where status='active'.
     */
    async getReceivedLikes(userId: string, limit = 20, cursor?: string) {
        return await prisma.like.findMany({
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            where: {
                likedId: userId,
                liked: true,
                status: 'active',
                // Also ensure NO blocks
                likerUser: {
                    blocksReceived: { none: { blockerId: userId } }, // I didn't block them
                    blocksMade: { none: { blockedId: userId } }      // They didn't block me
                }
            },
            include: {
                likerUser: {
                    select: {
                        id: true,
                        name: true,
                        profilePicture: true,
                        bio: true,
                        skills: true,
                        // Add other profile fields allowed in card
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /**
     * Helper to fetch a specific like (for accepting/declining)
     */
    async getLike(likeId: string) {
        return await prisma.like.findUnique({
            where: { id: likeId },
            include: { likerUser: true, likedUser: true }
        });
    }

    /**
     * Soft-delete a like (Decline)
     */
    async archiveLike(likeId: string) {
        return await prisma.like.update({
            where: { id: likeId },
            data: { status: 'archived' }
        });
    }
}

export const likeService = new LikeService();
