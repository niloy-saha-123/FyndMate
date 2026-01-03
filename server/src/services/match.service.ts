import { prisma } from '../lib/prisma.js';

export class MatchService {
    /**
     * Accept a Like and create a Match.
     * Atomic Transaction:
     * 1. Check/Lock Like.
     * 2. Archive Like.
     * 3. Create Match.
     * 4. Create Initial Messages.
     */
    async acceptLike(likeId: string, replyMessage?: string) {
        return await prisma.$transaction(async (tx) => {
            // 1. Get Like
            const like = await tx.like.findUnique({
                where: { id: likeId },
            });

            if (!like) throw new Error("Like not found.");
            if (like.status !== 'active') throw new Error("Like is no longer active.");

            // 2. Validate users exist (optional if FK constraints hold, but good for robust erros)
            // 3. Archive Like
            await tx.like.update({
                where: { id: likeId },
                data: { status: 'archived' },
            });

            // 4. Create Match
            // Sort IDs to ensure consistency (though we store user1/user2, we might often query by OR)
            // But typically we just store them as is? 
            // Plan Edge Case #7: "Inconsistent match pair order".
            // Prevention: "Always sort userIds (low, high)".
            // Let's do that.
            const [u1, u2] = [like.likerId, like.likedId].sort();

            // Check if match already exists (race condition prevention)
            const existingMatch = await tx.match.findUnique({
                where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
            });

            if (existingMatch) {
                if (existingMatch.status === 'unmatched') {
                    throw new Error("Cannot re-match with this user.");
                }
                return existingMatch; // Idempotent success
            }

            const match = await tx.match.create({
                data: {
                    user1Id: u1,
                    user2Id: u2,
                    status: 'active',
                },
            });

            // 5. Create Initial Messages
            // Message 1: The Liker's Intro
            if (like.message) {
                await tx.message.create({
                    data: {
                        matchId: match.id,
                        senderId: like.likerId,
                        content: like.message,
                        readAt: new Date(), // They read it to accept it? optional.
                    },
                });
            }

            // Message 2: The Accepter's Reply (if exists)
            if (replyMessage && replyMessage.trim().length > 0) {
                await tx.message.create({
                    data: {
                        matchId: match.id,
                        senderId: like.likedId, // The person accepting
                        content: replyMessage,
                    }
                });
            }

            return match;
        });
    }

    /**
     * Unmatch a user.
     */
    async unmatch(matchId: string, requestingUserId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) throw new Error("Match not found.");

        if (match.user1Id !== requestingUserId && match.user2Id !== requestingUserId) {
            throw new Error("Not authorized.");
        }

        // Soft delete / Hide
        // Plan says: "Update Match status -> 'unmatched'. Soft delete chat?"
        // Let's set status.
        return await prisma.match.update({
            where: { id: matchId },
            data: { status: 'unmatched' }
        });
    }

    /**
     * Get User's Matches (Inbox)
     */
    async getMatches(userId: string) {
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
                    orderBy: { createdAt: 'desc' } // Last message preview
                }
            },
            orderBy: {
                createdAt: 'desc', // Or last message time? Future improvement.
            }
        });
    }
}

export const matchService = new MatchService();
