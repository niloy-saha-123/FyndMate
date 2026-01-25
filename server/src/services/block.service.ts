/**
 * @file src/services/block.service.ts
 * @description Manages user blocking logic, including bidirectional blocks and interaction validation.
 */

import { prisma } from '../lib/prisma.js';

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
     * Automatically cleans up existing matches and archives likes.
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
                    data: { blockerId, blockedId },
                });

                // Remove existing matches
                await tx.match.deleteMany({
                    where: {
                        OR: [
                            { user1Id: blockerId, user2Id: blockedId },
                            { user1Id: blockedId, user2Id: blockerId },
                        ],
                    },
                });

                // Archive existing likes
                await tx.like.updateMany({
                    where: {
                        OR: [
                            { likerId: blockerId, likedId: blockedId },
                            { likerId: blockedId, likedId: blockerId },
                        ],
                    },
                    data: { status: 'archived' },
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
