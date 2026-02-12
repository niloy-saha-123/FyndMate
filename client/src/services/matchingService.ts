/**
 * @file client/src/services/matchingService.ts
 * @description Client-side service for the Matching Engine (Feed, Likes, Matches, Blocking).
 * 
 * CORE RESPONSIBILITIES:
 * 1. Discovery Feed: Fetching profiles to swipe on.
 * 2. Interaction: Sending Likes (with messages) or Passes.
 * 3. Inbox Management: Fetching/Accepting/Declining incoming likes.
 * 4. Message Management: Fetching active matches and unmatching.
 * 5. Safety: Blocking users.
 * 
 * BACKEND ENDPOINTS MAPPED:
 * - GET /api/feed
 * - POST /api/likes
 * - GET /api/likes/received
 * - POST /api/likes/:id/accept
 * - POST /api/matches
 * - POST /api/users/block
 * - POST /api/users/report
 * 
 * NOTE: All functions use the centralized apiClient which automatically
 * attaches the Authorization header from the auth context.
 */

import { apiClient } from '../lib/apiClient';
import {
    LIKES_RATE_LIMIT,
    LIKES_RATE_LIMIT_WINDOW_HOURS,
} from '../constants/validation';
import type { UserProfile } from '../types/profile';

// Re-export for convenience
export { LIKES_RATE_LIMIT, LIKES_RATE_LIMIT_WINDOW_HOURS };
export type { UserProfile };

/**
 * Custom error class for rate limit exceeded
 */
export class LikesRateLimitError extends Error {
  public retryAfter: number;
  public retryAfterHours: number;

  constructor(retryAfterSeconds: number, message?: string) {
    const hours = Math.ceil(retryAfterSeconds / 3600);
    super(message || `You've reached your daily limit of ${LIKES_RATE_LIMIT} collaboration requests. Try again in ${hours} hour${hours !== 1 ? 's' : ''}.`);
    this.name = 'LikesRateLimitError';
    this.retryAfter = retryAfterSeconds;
    this.retryAfterHours = hours;
  }
}

export interface Like {
    id: string;
    likerUser: UserProfile;
    message: string | null;
    createdAt: string;
}

export interface Match {
    id: string;
    user1: UserProfile;
    user2: UserProfile;
    // ... lastMessage etc.
}

/**
 * FETCH DISCOVERY FEED
 * @param limit Max profiles to fetch (default 20, max 50)
 * @param cursor Pagination cursor (optional)
 */
export async function getDiscoveryFeed(limit = 20, cursor?: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);

    const json = await apiClient.get<{ data: UserProfile[] }>(`/api/feed?${params}`);
    return json.data;
}

/**
 * SEND LIKE (OR PASS)
 * @param likedId ID of user to like/pass
 * @param liked true = LIKE, false = PASS
 * @param message Optional Intro Message (Required if liked=true)
 * @throws LikesRateLimitError when rate limit (30/day) is exceeded
 */
export async function sendLike(likedId: string, liked: boolean, message?: string) {
    try {
        return await apiClient.post('/api/likes', { likedId, liked, message });
    } catch (error: any) {
        // Check if error message indicates rate limiting
        const errorMessage = error?.message?.toLowerCase() || '';
        if (
            errorMessage.includes('too many requests') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('429')
        ) {
            // Extract retry time from error message if available, default to 24 hours
            const retryAfter = 24 * 60 * 60; // Default 24 hours in seconds
            throw new LikesRateLimitError(retryAfter);
        }
        throw error;
    }
}

/**
 * GET RECEIVED LIKES (LIKES SECTION/INBOX)
 */
export async function getReceivedLikes(): Promise<Like[]> {
    const json = await apiClient.get<{ data: Like[] }>('/api/likes/received');
    return json.data;
}

/**
 * ACCEPT A LIKE (CREATE MATCH)
 * @param likeId The ID of the Like to accept
 * @param replyMessage Optional reply to start conversation
 */
export async function acceptLike(likeId: string, replyMessage?: string) {
    return apiClient.post(`/api/likes/${likeId}/accept`, { replyMessage });
}

/**
 * DECLINE A LIKE (REMOVE FROM INBOX)
 * @param likeId The ID of the Like to decline
 */
export async function declineLike(likeId: string) {
    return apiClient.post(`/api/likes/${likeId}/decline`);
}

/**
 * GET ACTIVE MATCHES (MESSAGES)
 */
export async function getMatches(limit = 20, cursor?: string): Promise<{ data: Match[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    const json = await apiClient.get<{ data: Match[]; nextCursor?: string | null }>(`/api/matches?${params.toString()}`);
    return { data: json.data, nextCursor: json.nextCursor ?? null };
}

/**
 * UNMATCH A USER
 * @param matchId ID of the match to break
 */
export async function unmatchUser(matchId: string) {
    return apiClient.post(`/api/matches/${matchId}/unmatch`);
}

/**
 * BLOCK A USER
 * @param userId ID of the user to block
 */
export async function blockUser(userId: string) {
    return apiClient.post('/api/users/block', { userId });
}

/**
 * REPORT A USER (auto-block + hide forever)
 * @param userId ID of user to report
 * @param reason Human-readable report reason
 */
export async function reportUser(userId: string, reason: string) {
    return apiClient.post('/api/users/report', { userId, reason });
}
