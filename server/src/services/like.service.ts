import { prisma } from '../lib/prisma.js';
import { blockService } from './block.service.js';

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
            // If it was a PASS (liked=false) and we are now LIKING (liked=true) -> Update (Second Chance)
            if (!existing.liked && liked) {
                return await prisma.like.update({
                    where: { id: existing.id },
                    data: { liked: true, message, status: 'active', createdAt: new Date() }, // Reset time?
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
