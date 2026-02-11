/**
 * @file client/src/hooks/useFeed.ts
 * @description Custom hook to manage the Discovery Feed state and logic.
 * 
 * RESPONSIBILITIES:
 * 1. Fetching profiles with pagination (cursors).
 * 2. Manages "Swiping" state (removing users from local list instantly).
 * 3. Handling "End of Feed" state.
 * 4. Error states.
 * 
 * NOTE: Token is automatically attached via apiClient from auth context.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
    getDiscoveryFeed, 
    sendLike, 
    UserProfile, 
    LikesRateLimitError,
    LIKES_RATE_LIMIT,
    LIKES_RATE_LIMIT_WINDOW_HOURS,
} from '../services/matchingService';

export function useFeed() {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(true);
    const MAX_ATTEMPTS = 2;
    const RETRY_DELAY_MS = 500;

    // Initial Fetch
    const fetchFeed = useCallback(async (reset = false) => {
        if (loading || (!hasMore && !reset)) return;

        setLoading(true);
        setError(null);
        
        // If resetting, also reset hasMore so we can fetch fresh data
        if (reset) {
            setHasMore(true);
            setCursor(undefined);
        }

        const currentCursor = reset ? undefined : cursor;

        let attempts = 0;
        let data: UserProfile[] = [];
        let lastError: any = null;

        while (attempts < MAX_ATTEMPTS) {
            try {
                data = await getDiscoveryFeed(20, currentCursor);
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                attempts += 1;
                if (attempts >= MAX_ATTEMPTS) break;
                await new Promise(res => setTimeout(res, RETRY_DELAY_MS * attempts));
            }
        }

        if (lastError) {
            console.error('Feed fetch failed after retries', lastError);
            // TODO: Add telemetry (e.g., Sentry) and optional offline queue for feed fetch failures.
            setError(lastError.message || 'Failed to load feed');
            setLoading(false);
            return;
        }

            if (data.length < 20) {
                setHasMore(false); // No more to fetch
            } else {
                setHasMore(true);
            }

            // If resetting, replace list. Else, append.
            // DEDUPLICATION: Ensure no dupes if cursor reused (safety)
            setProfiles(prev => {
                const newList = reset ? data : [...prev, ...data];
                // Optional: Filter dupes by ID here if needed
                return newList;
            });

            // Update cursor to last item's ID
            if (data.length > 0) {
                setCursor(data[data.length - 1].id);
            }
        setLoading(false);
    }, [cursor, loading, hasMore]);

    // Swipe Action (Like or Pass)
    const swipe = async (likedId: string, liked: boolean, message?: string) => {
        // 1. Find the profile BEFORE removing it (for rollback)
        const swipedProfile = profiles.find(p => p.id === likedId);

        if (!swipedProfile) return; // Should not happen

        // 2. Optimistic Update: Remove from screen immediately
        setProfiles(prev => prev.filter(p => p.id !== likedId));

        try {
            // 3. API Call
            const result = await sendLike(likedId, liked, message);

            // 4. Check for Instant Match
            if (result.matched) {
                console.log("IT'S A MATCH!", result.match);
                return { matched: true, match: result.match };
            }
            return { matched: false };

        } catch (err) {
            console.error("Swipe failed:", err);

            // 5. ROLLBACK: Put the card back!
            // We usually put it back at the TOP (index 0) so the user sees it again.
            setProfiles(prev => [swipedProfile, ...prev]);

            // 6. Handle rate limit error with user-friendly popup
            if (err instanceof LikesRateLimitError) {
                Alert.alert(
                    "Can't Send Collaboration Request",
                    `You've reached your daily limit of ${LIKES_RATE_LIMIT} collaboration requests.\n\nPlease try again in ${err.retryAfterHours} hour${err.retryAfterHours !== 1 ? 's' : ''}.`,
                    [{ text: 'OK', style: 'default' }]
                );
                setError(`Daily limit reached (${LIKES_RATE_LIMIT}/${LIKES_RATE_LIMIT_WINDOW_HOURS}hr)`);
                return { matched: false, rateLimited: true };
            }

            setError("Failed to record swipe. Please try again.");
            return { matched: false, error: true };
        }
    };

    return { profiles, loading, error, hasMore, fetchFeed, swipe };
}
