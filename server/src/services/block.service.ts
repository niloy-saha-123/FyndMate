/**
 * @file src/services/block.service.ts
 * @description Manages user blocking logic and safety features.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Bidirectional Blocking: If A blocks B, neither can see each other.
 * 2. Interaction Validation: PREVENTS pre-emptive blocking from Feed.
 *    - You must have a Match or Like interaction to block someone.
 * 3. Cleanup: When a block happens, it automatically cleans up:
 *    - Existing Matches (Unmatches them).
 *    - Existing Likes (Archives them).
 * 
 * Used by: matching.routes.ts
 */
import { prisma } from '../lib/prisma.js';

export class BlockService {
    /**
     * Check if there is any block between two users (bidirectional).
     * Returns true if either user has blocked the other.
     */
    async hasBlock(userA: string, userB: string): Promise<boolean> {
        const count = await prisma.block.count({
            where: {
                OR: [
                    { blockerId: userA, blockedId: userB },
                    { blockerId: userB, blockedId: userA },
                ],
            },
        });
        return count > 0;
    }

    /**
     * Block a user.
     * Also ensures any existing match/like logic is handled (e.g. unmatch).
     */
    async blockUser(blockerId: string, blockedId: string) {
        // 1. Validation: Must have Interaction (Match or Like) to block
        // We strictly disallow generic blocking from Feed to prevent abuse/confusion.

        // Check Match
        const matchExists = await prisma.match.findFirst({
            where: {
                OR: [
                    { user1Id: blockerId, user2Id: blockedId },
                    { user1Id: blockedId, user2Id: blockerId },
                ]
            }
        });

        // Check Like (Incoming or Outgoing)
        const likeExists = await prisma.like.findFirst({
            where: {
                OR: [
                    { likerId: blockerId, likedId: blockedId },
                    { likerId: blockedId, likedId: blockerId },
                ]
            }
        });

        if (!matchExists && !likeExists) {
            throw new Error("You can only block users you have matched with or interacted with.");
        }

        // 2. Check if already blocked
        const existing = await prisma.block.findUnique({
            where: {
                blockerId_blockedId: { blockerId, blockedId },
            },
        });

        if (existing) return existing;

        // 3. Create Block and auto-resolve any conflicts
        // We use a transaction to ensure we clean up matches/likes if they exist
        return await prisma.$transaction(async (tx) => {
            // Create block
            const block = await tx.block.create({
                data: { blockerId, blockedId },
            });

            // Validations: Remove any existing Match
            await tx.match.deleteMany({
                where: {
                    OR: [
                        { user1Id: blockerId, user2Id: blockedId },
                        { user1Id: blockedId, user2Id: blockerId },
                    ],
                },
            });

            // Remove any existing active Likes (keep archived for history? or hard delete? 
            // Plan says: "Blocked after match -> Auto-unmatch".
            // We also hide them from feed, so deleting/archiving likes is good hygiene.
            // Let's archive them to be safe.
            await tx.like.updateMany({
                where: {
                    OR: [
                        { likerId: blockerId, likedId: blockedId },
                        { likerId: blockedId, likedId: blockerId },
                    ],
                },
                data: { status: 'archived' }, // Soft hide
            });

            return block;
        });
    }

    /**
     * Unblock a user.
     */
    async unblockUser(blockerId: string, blockedId: string) {
        return await prisma.block.delete({
            where: {
                blockerId_blockedId: { blockerId, blockedId },
            },
        });
    }
}

export const blockService = new BlockService();
