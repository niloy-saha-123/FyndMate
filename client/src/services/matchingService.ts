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
 * TODO (DEV):
 * - Add caching (TanStack Query) for Feed Performance?
 * - Add error monitoring (Sentry).
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface UserProfile {
    id: string;
    name: string;
    profilePicture: string | null;
    bio: string | null;
    skills: string[];
    // ... add other fields as needed
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
 * @param token JWT Auth Token
 * @param limit Max profiles to fetch (default 20, max 50)
 * @param cursor Pagination cursor (optional)
 */
export async function getDiscoveryFeed(token: string, limit = 20, cursor?: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(`${API_BASE_URL}/feed?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch feed');
    }

    // Backend returns { data: [...] }
    const json = await response.json();
    return json.data;
}

/**
 * SEND LIKE (OR PASS)
 * @param token JWT Auth Token
 * @param likedId ID of user to like/pass
 * @param liked true = LIKE, false = PASS
 * @param message Optional Intro Message (Required if liked=true)
 */
export async function sendLike(token: string, likedId: string, liked: boolean, message?: string) {
    const response = await fetch(`${API_BASE_URL}/likes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ likedId, liked, message }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send like');
    }

    return await response.json(); // Returns created Like object OR Match object (if instant match)
}

/**
 * GET RECEIVED LIKES (LIKES SECTION/INBOX)
 * @param token JWT Auth Token
 */
export async function getReceivedLikes(token: string): Promise<Like[]> {
    const response = await fetch(`${API_BASE_URL}/likes/received`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch likes');
    }

    const json = await response.json();
    return json.data; // Route returns { data: [...] }
}

/**
 * ACCEPT A LIKE (CREATE MATCH)
 * @param token JWT Auth Token
 * @param likeId The ID of the Like to accept
 * @param replyMessage Optional reply to start conversation
 */
export async function acceptLike(token: string, likeId: string, replyMessage?: string) {
    const response = await fetch(`${API_BASE_URL}/likes/${likeId}/accept`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replyMessage }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept like');
    }

    return await response.json(); // Returns Match object
}

/**
 * DECLINE A LIKE (REMOVE FROM INBOX)
 * @param token JWT Auth Token
 * @param likeId The ID of the Like to decline
 */
export async function declineLike(token: string, likeId: string) {
    const response = await fetch(`${API_BASE_URL}/likes/${likeId}/decline`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to decline like');
    }
}

/**
 * GET ACTIVE MATCHES (CHATS)
 * @param token JWT Auth Token
 */
export async function getMatches(token: string): Promise<Match[]> {
    const response = await fetch(`${API_BASE_URL}/matches`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch matches');
    }

    const json = await response.json();
    return json.data; // Route returns { data: [...] }
}

/**
 * UNMATCH A USER
 * @param token JWT Auth Token
 * @param matchId ID of the match to break
 */
export async function unmatchUser(token: string, matchId: string) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/unmatch`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unmatch');
    }
}

/**
 * BLOCK A USER
 * @param token JWT Auth Token
 * @param userId ID of the user to block
 */
export async function blockUser(token: string, userId: string) {
    const response = await fetch(`${API_BASE_URL}/users/block`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to block user');
    }
}
