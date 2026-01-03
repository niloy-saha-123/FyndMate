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
        // 1. Check if already blocked
        const existing = await prisma.block.findUnique({
            where: {
                blockerId_blockedId: { blockerId, blockedId },
            },
        });

        if (existing) return existing;

        // 2. Create Block and auto-resolve any conflicts
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
