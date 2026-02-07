/**
 * @file client/src/services/matchingService.ts
 * @description Client-side service for the Matching Engine (Feed, Likes, Matches, Blocking).
 * 
 * CORE RESPONSIBILITIES:
 * 1. Discovery Feed: Fetching profiles to swipe on.
 * 2. Interaction: Sending Likes (with messages) or Passes.
 * 3. Inbox Management: Fetching/Accepting/Declining incoming likes.
 * 4. Chat Management: Fetching active matches and unmatching.
 * 5. Safety: Blocking users.
 * 
 * BACKEND ENDPOINTS MAPPED:
 * - GET /api/feed
 * - POST /api/likes
 * - GET /api/likes/received
 * - POST /api/likes/:id/accept
 * - POST /api/matches
 * - POST /api/users/block
 * 
 * NOTE: All functions use the centralized apiClient which automatically
 * attaches the Authorization header from the auth context.
 */

import { apiClient } from '../lib/apiClient';

export interface UserProfile {
    id: string;
    name: string;
    profilePicture: string | null;
    bio: string | null;
    skills: string[];
    interests?: string[];
    experience?: string | null;
    commitment?: string | null;
    city?: string | null;
    country?: string | null;
    locationSharing?: string | null;
    // UI-specific field (may not be returned by all endpoints)
    age?: number | null;
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
 */
export async function sendLike(likedId: string, liked: boolean, message?: string) {
    return apiClient.post('/api/likes', { likedId, liked, message });
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
 * GET ACTIVE MATCHES (CHATS)
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
