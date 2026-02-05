/**
 * @file src/services/block.service.ts
 * @description Manages user blocking logic, including bidirectional blocks and interaction validation.
 */

import { prisma } from '../lib/prisma.js';

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

export class BlockService {
    /**
     * Check if a bidirectional block exists between two users.
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
     * Validates that an interaction exists before blocking to prevent feed abuse.
     * Updates matches to BLOCKED status and declines pending likes.
     */
    async blockUser(blockerId: string, blockedId: string) {
        if (blockerId === blockedId) {
            throw new Error("Cannot block yourself.");
        }

        // Ensure an interaction exists (Match or Incoming Like)
        const matchExists = await prisma.match.findFirst({
            where: {
                OR: [
                    { user1Id: blockerId, user2Id: blockedId },
                    { user1Id: blockedId, user2Id: blockerId },
                ]
            }
        });

        const incomingLike = await prisma.like.findFirst({
            where: {
                likerId: blockedId,
                likedId: blockerId
            }
        });

        if (!matchExists && !incomingLike) {
            throw new Error("You can only block users who have liked you or matched with you.");
        }

        const existing = await prisma.block.findUnique({
            where: {
                blockerId_blockedId: { blockerId, blockedId },
            },
        });

        if (existing) return existing;

        try {
            return await prisma.$transaction(async (tx) => {
                const block = await tx.block.create({
                    data: { 
                        blockerId, 
                        blockedId,
                    },
                });

                // Update existing matches to BLOCKED status
                if (matchExists) {
                    await tx.match.update({
                        where: { id: matchExists.id },
                        data: { status: MATCH_STATUS.BLOCKED },
                    });
                }

                // Decline existing likes in both directions
                await tx.like.updateMany({
                    where: {
                        OR: [
                            { likerId: blockerId, likedId: blockedId },
                            { likerId: blockedId, likedId: blockerId },
                        ],
                        status: LIKE_STATUS.PENDING,
                    },
                    data: { status: LIKE_STATUS.DECLINED },
                });

                return block;
            });
        } catch (error: any) {
            // Handle race condition for duplicate block creation
            if (error.code === 'P2002') {
                const existingBlock = await prisma.block.findUnique({
                    where: {
                        blockerId_blockedId: { blockerId, blockedId },
                    },
                });
                if (existingBlock) return existingBlock;
            }
            throw error;
        }
    }

    async unblockUser(blockerId: string, blockedId: string) {
        return await prisma.block.delete({
            where: {
                blockerId_blockedId: { blockerId, blockedId },
            },
        });
    }
}

export const blockService = new BlockService();
