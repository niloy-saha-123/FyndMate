/**
 * @file src/services/feed.service.ts
 * @description Generates the discovery feed for users.
 * Handles exclusion logic (likes, matches, blocks) and implements caching for performance.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { filterLocationArrayByPrivacy } from '../utils/locationPrivacy.js';

// TODO [100K Users]: Add CDN-level caching for feed results (CloudFront, Fastly) with geographic distribution
// TODO [100K Users]: Implement cache stampede protection (locking) to prevent thundering herd on cache misses
// TODO [10K Users]: Add cache hit/miss metrics for monitoring and optimization

type FeedUser = Prisma.UserGetPayload<{
    select: {
        id: true;
        name: true;
        profilePicture: true;
        bio: true;
        experience: true;
        skills: true;
        interests: true;
        city: true;
        country: true;
        locationSharing: true;
    }
}>;

export class FeedService {
    /**
     * Get the Discovery Feed.
     * Aggregates all exclusions to return fresh profiles.
     */
    async getFeed(userId: string, limit = 20, cursor?: string): Promise<FeedUser[]> {
        // Validation: UUID format check (Supabase uses UUIDs)
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
        // 1. Users I have already liked (incoming or outgoing)
        // 2. Users I am matched with
        // 3. Users I have blocked or who have blocked me
        //
        // Note: We use a single optimized query to fetch all exclusion IDs at once.
        const excludedIds = new Set<string>();
        excludedIds.add(userId);

        const [outgoingLikes, incomingLikes, matches, blocks] = await Promise.all([
            // Outgoing likes/passes (I already swiped on them) - should not appear again
            prisma.like.findMany({
                where: { likerId: userId },
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

        // Exclude users I've already swiped on (liked or passed)
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
                id: true,
                name: true,
                profilePicture: true,
                bio: true,
                experience: true,
                skills: true,
                interests: true,
                city: true,
                country: true,
                locationSharing: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const result = filterLocationArrayByPrivacy(users);

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

export type { FeedUser };
