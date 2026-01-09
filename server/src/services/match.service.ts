/**
 * @file src/services/match.service.ts
 * @description Manages active connections, chat initiation, and unmatching.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Transactional Acceptance: Converts a 'Like' into a 'Match' atomically.
 *    - Archives the Like -> Creates Match -> Creates Intro Message.
 *    - This ensures no data is lost during the handshake.
 * 2. Unmatching: Soft-deletes the connection (status='unmatched').
 *    - Prevents users from ever seeing each other again.
 * 3. Match List: Retrieves the user's active matches for the "Chats" screen.
 * 
 * Used by: matching.routes.ts
 */
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
                where: { id: likeId }
            });

            if (!like) throw new Error("Like not found.");
            if (like.status !== 'active') throw new Error("Like is no longer active.");

            // Capture IDs immediately to prevent any proxy/reference issues
            const likerId = String(like.likerId);
            const likedId = String(like.likedId);
            const introContent = like.message;

            // 2. Create Match
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

            const match = await tx.match.create({
                data: {
                    user1Id: u1,
                    user2Id: u2,
                    status: 'active',
                },
            });

            // 3. Create Initial Messages
            // Message 1: The Liker's Intro (User B)
            const now = new Date();
            if (introContent) {
                await tx.message.create({
                    data: {
                        matchId: match.id,
                        senderId: likerId,
                        content: introContent,
                        createdAt: now,  // Explicit timestamp
                    },
                });
            }

            // Message 2: The Accepter's Reply (User A)
            // Add 1ms to ensure it's always newer than intro
            if (replyMessage && replyMessage.trim().length > 0) {
                await tx.message.create({
                    data: {
                        matchId: match.id,
                        senderId: likedId,
                        content: replyMessage,
                        createdAt: new Date(now.getTime() + 1),  // 1ms later
                    }
                });
            }

            // 4. Archive Like
            await tx.like.update({
                where: { id: likeId },
                data: { status: 'archived' },
            });

            return match;
        });
    }

    /**
     * Unmatch a user.
     */
    async unmatch(matchId: string, requestingUserId: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) throw new Error("Match not found.");

        // Prevent unmatching already-unmatched matches
        if (match.status === 'unmatched') {
            throw new Error("Match is already unmatched.");
        }

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
     * Get User's Matches (The "Inbox" / Chat List)
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
