import { prisma } from '../lib/prisma.js';

export class FeedService {
    /**
     * Get the Discovery Feed.
     * Aggregates all exclusions to return fresh profiles.
     */
    async getFeed(userId: string, limit = 20, cursor?: string) {
        // 1. Safeguard: Limit Cap
        const TAKE_LIMIT = Math.min(limit, 50);

        // 2. Fetch Exclusions (The "NOT IN" Strategy)
        // A. My Interactions (I liked/passed them)
        const myInteractions = await prisma.like.findMany({
            where: { likerId: userId },
            select: { likedId: true },
        });

        // B. Incoming Likes (They liked me -> They are in my Inbox, not Feed)
        // Note: If they PASSED me (liked=false), they DO appear in feed (Asymmetric).
        const incomingLikes = await prisma.like.findMany({
            where: { likedId: userId, liked: true },
            select: { likerId: true },
        });

        // C. Matches (Active or Unmatched need to be excluded? Unmatched definitely excluded)
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

        // 3. Flatten IDs
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
                location: true,
                // Don't leak private data
            },
            orderBy: {
                // Randomize? Prisma doesn't support RAND() easily.
                // For MVP, created desc is fine, or simple pagination.
                // Randomization is a "Future Optimization".
                createdAt: 'desc',
            },
        });

        return users;
    }
}

export const feedService = new FeedService();
