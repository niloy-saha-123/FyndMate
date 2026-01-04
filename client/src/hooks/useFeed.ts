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
 * TODO (DEV): 
 * - Implement "Optimistic Updates" (remove card before server confirms).
 * - Add "Undo" functionality (if allowed).
 */

import { useState, useEffect, useCallback } from 'react';
import { getDiscoveryFeed, sendLike, UserProfile } from '../services/matchingService';

export function useFeed(token: string) {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(true);

    // Initial Fetch
    const fetchFeed = useCallback(async (reset = false) => {
        if (loading || (!hasMore && !reset)) return;

        setLoading(true);
        setError(null);

        try {
            // If resetting, clear cursor
            const currentCursor = reset ? undefined : cursor;
            const data = await getDiscoveryFeed(token, 20, currentCursor);

            if (data.length < 20) {
                setHasMore(false); // No more to fetch
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
        } catch (err: any) {
            setError(err.message || 'Failed to load feed');
        } finally {
            setLoading(false);
        }
    }, [token, cursor, loading, hasMore]);

    // Swipe Action (Like or Pass)
    const swipe = async (likedId: string, liked: boolean, message?: string) => {
        // 1. Find the profile BEFORE removing it (for rollback)
        const swipedProfile = profiles.find(p => p.id === likedId);

        if (!swipedProfile) return; // Should not happen

        // 2. Optimistic Update: Remove from screen immediately
        setProfiles(prev => prev.filter(p => p.id !== likedId));

        try {
            // 3. API Call
            const result = await sendLike(token, likedId, liked, message);

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

            setError("Failed to record swipe. Please try again.");
        }
    };

    return { profiles, loading, error, hasMore, fetchFeed, swipe };
}
