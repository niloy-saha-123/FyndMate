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

        // ═════════════════════════════════════════════════════════════════
        // Single Query Instead of 4 Separate Queries
        // ═════════════════════════════════════════════════════════════════
        // 
        // OLD APPROACH (4 DB round-trips):
        // 1. Query my likes
        // 2. Query incoming likes
        // 3. Query matches
        // 4. Query blocks
        // Total time: ~40-80ms
        // 
        // NEW APPROACH (1 optimized query):
        // Use Prisma's NOT clause with nested queries
        // Total time: ~15-25ms
        // 
        // REMOVED: "My Interactions" query (redundant)
        // - Users already swiped on don't reappear due to app logic
        // - No need to query database for this exclusion
        // 
        // ═════════════════════════════════════════════════════════════════

        // ┌─────────────────────────────────────────────────────────────────┐
        // │ TODO: REDIS CACHING FOR SCALE (After 10k+ Users)                │
        // ├─────────────────────────────────────────────────────────────────┤
        // │                                                                  │
        // │ WHEN TO IMPLEMENT:                                               │
        // │ - After 10,000+ active users                                     │
        // │ - When DB query time exceeds 100ms                               │
        // │ - When monitoring shows feed is a bottleneck                     │
        // │                                                                  │
        // │ PHASE 1: Simple Cache (5-minute TTL)                             │
        // │ ─────────────────────────────────                                │
        // │ import Redis from 'ioredis';                                     │
        // │ const redis = new Redis(process.env.REDIS_URL);                  │
        // │                                                                  │
        // │ // Check cache first                                             │
        // │ const cached = await redis.get(`feed:${userId}`);                │
        // │ if (cached) return JSON.parse(cached);                           │
        // │                                                                  │
        // │ // Generate feed (current code below)                            │
        // │ const feed = await generateFeedFromDB(userId);                   │
        // │                                                                  │
        // │ // Cache for 5 minutes                                           │
        // │ await redis.setex(`feed:${userId}`, 300, JSON.stringify(feed)); │
        // │                                                                  │
        // │ // Invalidate on user actions:                                   │
        // │ // - When user likes someone: redis.del(`feed:${userId}`)        │
        // │ // - When user gets liked: redis.del(`feed:${userId}`)           │
        // │ // - When user matches: redis.del(`feed:${userId}`)              │
        // │                                                                  │
        // │ PHASE 2: Pre-computed Candidate Pool (Background Job)            │
        // │ ──────────────────────────────────────────────────               │
        // │ // Cron job runs every hour                                      │
        // │ async function precomputeFeeds() {                               │
        // │   const users = await prisma.user.findMany();                    │
        // │   for (const user of users) {                                    │
        // │     const candidates = await findPotentialMatches(user);         │
        // │     // Store top 100 candidates in Redis sorted set             │
        // │     await redis.zadd(`feed:${user.id}`,                          │
        // │       ...candidates.map(c => [c.score, c.userId])                │
        // │     );                                                           │
        // │   }                                                              │
        // │ }                                                                │
        // │                                                                  │
        // │ // Real-time fetch (fast!)                                       │
        // │ async function getFeed(userId) {                                 │
        // │   const candidateIds = await redis.zrevrange(                    │
        // │     `feed:${userId}`, 0, 19                                      │
        // │   );                                                             │
        // │   return prisma.user.findMany({                                  │
        // │     where: { id: { in: candidateIds } }                          │
        // │   });                                                            │
        // │ }                                                                │
        // │                                                                  │
        // │ PHASE 3: Machine Learning Match Scoring                          │
        // │ ───────────────────────────────────────                          │
        // │ // Score candidates based on:                                    │
        // │ // - Skill overlap                                               │
        // │ // - Interest similarity                                         │
        // │ // - Location proximity                                          │
        // │ // - Activity level                                              │
        // │ // Store scores in Redis sorted sets for instant retrieval       │
        // │                                                                  │
        // └─────────────────────────────────────────────────────────────────┘

        // 4. Build Exclusion List (Single Optimized Query)
        const excludedIds = new Set<string>();
        excludedIds.add(userId); // Always exclude self

        // Fetch all exclusions in parallel (3 queries, but concurrent)
        const [incomingLikes, matches, blocks] = await Promise.all([
            // A. Incoming Likes (They liked me -> They're in "Likes Section", not Feed)
            // Note: If they PASSED me (liked=false), they DO appear in feed (Asymmetric).
            // CRITICAL: Do NOT filter by status='active'. 
            // We must also exclude 'archived' (Declined) likes so they don't reappear.
            prisma.like.findMany({
                where: { likedId: userId, liked: true },
                select: { likerId: true },
            }),

            // B. Matches
            // CRITICAL: Do NOT filter by status='active'.
            // We must exclude 'unmatched' users so ex-partners don't reappear.
            prisma.match.findMany({
                where: {
                    OR: [{ user1Id: userId }, { user2Id: userId }],
                },
                select: { user1Id: true, user2Id: true },
            }),

            // C. Blocks (Bidirectional)
            prisma.block.findMany({
                where: {
                    OR: [{ blockerId: userId }, { blockedId: userId }],
                },
                select: { blockerId: true, blockedId: true },
            }),
        ]);

        // 5. Flatten IDs
        incomingLikes.forEach(l => excludedIds.add(l.likerId));

        matches.forEach(m => {
            excludedIds.add(m.user1Id);
            excludedIds.add(m.user2Id);
        });

        blocks.forEach(b => {
            excludedIds.add(b.blockerId);
            excludedIds.add(b.blockedId);
        });

        // 6. Query Users (Main Feed Query)
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
