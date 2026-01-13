/**
 * @file src/services/feed.service.ts
 * @description The "Discovery Engine". Calculates which profiles a user should see.
 * 
 * CORE RESPONSIBILITIES:
 * 1. The "Double Exclusion" Logic:
 *    - Exclude people I Liked/Passed (I already saw them).
 *    - Exclude people who Liked ME (They belong in the "Likes Section", not Feed).
 *    - Exclude Matches and Blocks.
 * 2. Pagination: Uses a cursor-based approach for infinite scroll.
 * 3. Limits: Hard-capped at 50 profiles per request for DoS protection.
 * 
 * Used by: feed.routes.ts
 */
import { prisma } from '../lib/prisma.js';
import { filterLocationArrayByPrivacy } from '../utils/locationPrivacy.js';

export class FeedService {
    /**
     * Get the Discovery Feed.
     * Aggregates all exclusions to return fresh profiles.
     */
    async getFeed(userId: string, limit = 20, cursor?: string) {
        // 1. Validation: ID Format Check
        // CUID format: starts with 'c', followed by alphanumeric characters
        // Length can vary, but typically 8+ characters minimum
        // This catches obviously invalid formats like 'invalid-id-format' with dashes or special chars
        const cuidRegex = /^c[a-z0-9]{7,}$/i;
        if (!cuidRegex.test(userId)) {
            throw new Error("Invalid user ID format.");
        }

        // 2. Validation: User Existence Check
        // Return empty array if user doesn't exist (graceful handling)
        const userExists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
        });
        if (!userExists) {
            return [];
        }

        // 3. Safeguard: Limit Cap
        const TAKE_LIMIT = Math.min(limit, 50);

        // 4. Fetch Exclusions (The "NOT IN" Strategy)
        // A. My Interactions (I liked/passed them)
        const myInteractions = await prisma.like.findMany({
            where: { likerId: userId },
            select: { likedId: true },
        });

        // B. Incoming Likes (They liked me -> They are in my Likes Section, not Feed)
        // Note: If they PASSED me (liked=false), they DO appear in feed (Asymmetric).
        // CRITICAL: Do NOT filter by status='active'. 
        // We must also exclude 'archived' (Declined) likes so they don't reappear.
        const incomingLikes = await prisma.like.findMany({
            where: { likedId: userId, liked: true },
            select: { likerId: true },
        });

        // C. Matches
        // CRITICAL: Do NOT filter by status='active'.
        // We must exclude 'unmatched' users so ex-partners don't reappear.
        const matches = await prisma.match.findMany({
            where: {
                OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            select: { user1Id: true, user2Id: true },
        });

        // D. Blocks (Bidirectional)
        const blocks = await prisma.block.findMany({
            where: {
                OR: [{ blockerId: userId }, { blockedId: userId }],
            },
            select: { blockerId: true, blockedId: true },
        });

        // 5. Flatten IDs
        const excludedIds = new Set<string>();

        excludedIds.add(userId); // Exclude self

        myInteractions.forEach(l => excludedIds.add(l.likedId));
        incomingLikes.forEach(l => excludedIds.add(l.likerId));

        matches.forEach(m => {
            excludedIds.add(m.user1Id);
            excludedIds.add(m.user2Id);
        });

        blocks.forEach(b => {
            excludedIds.add(b.blockerId);
            excludedIds.add(b.blockedId);
        });

        // 4. Query Users
        const users = await prisma.user.findMany({
            take: TAKE_LIMIT,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            where: {
                id: { notIn: Array.from(excludedIds) },
                // Add Filters:
                profilePicture: { not: null }, // Must have photo
                // blocked: false? (Schema user.banned)
                banned: false,
            },
            select: {
                id: true,
                name: true,
                profilePicture: true,
                bio: true,
                experience: true,
                skills: true,
                interests: true,
                // Location fields (will be filtered based on locationSharing)
                city: true,
                country: true,
                locationSharing: true,
                // Don't leak private data (never expose lat/lon)
            },
            orderBy: {
                // Randomize? Prisma doesn't support RAND() easily.
                // For MVP, created desc is fine, or simple pagination.
                // Randomization is a "Future Optimization".
                createdAt: 'desc',
            },
        });

        // Apply location privacy filter before returning
        return filterLocationArrayByPrivacy(users);
    }
}

export const feedService = new FeedService();
