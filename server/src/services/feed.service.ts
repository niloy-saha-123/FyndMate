/**
 * @file src/services/feed.service.ts
 * @description Generates the discovery feed for users.
 * Handles exclusion logic (likes, matches, blocks) and implements caching for performance.
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { filterLocationArrayByPrivacy } from '../utils/locationPrivacy.js';
import { publicUserFeedSelect, type PublicFeedUser } from '../utils/publicUser.js';
import { signProfilePicture } from '../utils/profilePicture.js';

function computeAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = now.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
        age--;
    }
    return age;
}

// TODO [100K Users]: Add CDN-level caching for feed results (CloudFront, Fastly) with geographic distribution
// TODO [100K Users]: Implement cache stampede protection (locking) to prevent thundering herd on cache misses
// TODO [10K Users]: Add cache hit/miss metrics for monitoring and optimization

// ============================================
// TODO [PREMIUM FEATURE]: Radius-Based Matching
// ============================================
// GOAL: Allow users to find matches within X km radius (e.g., 5km, 10km, 25km, 50km)
//
// IMPLEMENTATION:
// 1. Add new columns to User table (via Prisma migration):
//    - searchLatitude: Float? (user's search center point, can differ from actual location)
//    - searchLongitude: Float? (for "search in New York" while living in LA)
//    - searchRadiusKm: Int? (user's preferred radius, default 50km)
//
// 2. Create new function: getFeedWithRadius(userId, radiusKm, limit, cursor)
//    - Query current user's lat/long (INTERNAL ONLY, never expose in response)
//    - Use PostGIS or Haversine formula to calculate distance:
//      ```sql
//      SELECT id, name, city, country,
//        (6371 * acos(cos(radians(?)) * cos(radians(latitude)) 
//              * cos(radians(longitude) - radians(?)) 
//              + sin(radians(?)) * sin(radians(latitude)))) AS distance
//      FROM "User"
//      WHERE distance < ?
//      ORDER BY distance ASC
//      ```
//    - CRITICAL: SELECT only safe fields (id, name, city, country)
//    - NEVER include latitude/longitude in response
//
// 3. Add route: GET /api/feed?radius=10 (protected by premium tier check)
//
// 4. Privacy consideration: Optionally show approximate distance ("~5 km away")
//    without revealing exact coordinates
//
// SECURITY: lat/long used ONLY for internal calculations, NEVER returned to client

// ============================================
// TODO [PREMIUM FEATURE]: Manual Location Override
// ============================================
// GOAL: Let users search for matches in different cities (e.g., traveling, relocating)
//
// IMPLEMENTATION:
// 1. Add endpoint: POST /api/location/search
//    Body: { city: "New York", country: "USA" }
//
// 2. Geocode city → lat/long using geocodingService
//    - Store in searchLatitude/searchLongitude (separate from real location)
//    - Use for radius matching but don't affect user's actual profile location
//
// 3. Update getFeedWithRadius() to use searchLat/searchLong if set,
//    otherwise fall back to actual latitude/longitude
//
// 4. Add "Currently searching in: New York" indicator in client UI
//
// 5. Allow reset: DELETE /api/location/search (revert to actual location)
//
// DATABASE FIELDS NEEDED:
//   - searchLatitude: Float? (null = use actual location)
//   - searchLongitude: Float? (null = use actual location)
//   - searchCity: String? (display "Searching in X")
//   - searchCountry: String?
//   - searchSetAt: DateTime? (when they set it, for expiry)
//
// PRIVACY: Actual user location still hidden, only search center changes

type FeedUserWithAge = PublicFeedUser & { age: number | null };

export class FeedService {
    /**
     * Get the Discovery Feed.
     * Aggregates all exclusions to return fresh profiles.
     */
    async getFeed(userId: string, limit = 20, cursor?: string): Promise<FeedUserWithAge[]> {
        // Validation: UUID format check (Supabase/Prisma uses UUIDs)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            throw new Error("Invalid user ID format.");
        }

        // Cache Hit: Return cached feed if this is an initial load (no cursor)
        const cacheKey = `feed:${userId}`;
        if (!cursor) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            } catch (redisError) {
                // Redis unavailable - continue without cache
                console.warn('Redis cache miss (error):', redisError);
            }
        }

        const userExists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
        });
        if (!userExists) {
            return [];
        }

        const TAKE_LIMIT = Math.min(limit, 50);

        // Build Exclusion List
        // We exclude:
        // 1. Users I have already LIKED (not passed - passed users can reappear)
        // 2. Users I am matched with
        // 3. Users I have blocked or who have blocked me
        //
        // Note: We use a single optimized query to fetch all exclusion IDs at once.
        const excludedIds = new Set<string>();
        excludedIds.add(userId);

        const [outgoingLikes, incomingLikes, matches, blocks] = await Promise.all([
            // Outgoing LIKES only (not passes) - users I liked should not reappear
            // Passed users (liked=false) CAN reappear in the feed for second chances
            prisma.like.findMany({
                where: { likerId: userId, liked: true },
                select: { likedId: true },
            }),

            // Incoming likes (they liked me) should appear in "Likes You", not Feed.
            prisma.like.findMany({
                where: { likedId: userId, liked: true },
                select: { likerId: true },
            }),

            prisma.match.findMany({
                where: {
                    OR: [{ user1Id: userId }, { user2Id: userId }],
                },
                select: { user1Id: true, user2Id: true },
            }),

            prisma.block.findMany({
                where: {
                    OR: [{ blockerId: userId }, { blockedId: userId }],
                },
                select: { blockerId: true, blockedId: true },
            }),
        ]);

        // Exclude users I've already LIKED (passed users can reappear)
        outgoingLikes.forEach(l => excludedIds.add(l.likedId));

        // Exclude users who have liked me (they appear in "Likes You" section)
        incomingLikes.forEach(l => excludedIds.add(l.likerId));

        matches.forEach(m => {
            excludedIds.add(m.user1Id);
            excludedIds.add(m.user2Id);
        });

        blocks.forEach(b => {
            excludedIds.add(b.blockerId);
            excludedIds.add(b.blockedId);
        });

        // Fetch Users (The Feed)
        const users = await prisma.user.findMany({
            take: TAKE_LIMIT,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            where: {
                id: { notIn: Array.from(excludedIds) },
                banned: false,
                // In development, show all users for testing
                // In production, only show users who have completed onboarding
                ...(process.env.NODE_ENV === 'production' 
                    ? { onboardingCompleted: true }
                    : {}),
            },
            select: {
                ...publicUserFeedSelect,
                birthDate: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const withAge: FeedUserWithAge[] = users.map((u) => ({
            ...u,
            age: computeAge(u.birthDate as any),
        }));

        const priv = filterLocationArrayByPrivacy(withAge).map((u: any) => {
            delete u.birthDate;
            return u;
        });

// TODO [POST-MVP]: Add cache stampede protection (lock key) around feed generation.
// TODO [POST-MVP]: Batch exclusions with a single query/CTE if feed load grows.
// TODO [POST-MVP]: Move feed limits/TTL to config (e.g., limits.ts with env overrides) to avoid scattered magic numbers.
// TODO [POST-MVP]: Make onboarding filter a config flag (no dev/prod divergence).
        const result = await Promise.all(
            priv.map(async (u: any) => ({
                ...u,
                profilePicture: await signProfilePicture(u.profilePicture),
            }))
        );

        // Cache Miss: Store result for 5 minutes if this was an initial load
        if (!cursor && result.length > 0) {
            try {
                await redis.setex(cacheKey, 300, JSON.stringify(result));
            } catch (redisError) {
                // Redis unavailable - continue without caching
                console.warn('Redis cache write failed:', redisError);
            }
        }

        return result;
    }
}

export const feedService = new FeedService();

export type { FeedUserWithAge as FeedUser };
