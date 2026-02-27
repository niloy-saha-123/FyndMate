/**
 * @file client/src/hooks/useMatches.ts
 * @description Custom hook to manage the Active Matches (Messages) state.
 * 
 * RESPONSIBILITIES:
 * 1. Fetching Active Matches.
 * 2. Unmatching users.
 * 3. Blocking users (optional, usually done in message settings).
 * 
 * NOTE: Token is automatically attached via apiClient from auth context.
 */

import { useState, useCallback } from 'react';
import { getMatches, unmatchUser, blockUser, Match } from '../services/matchingService';

export function useMatches() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const PAGE_SIZE = 20;

    // Fetch Matches
    const fetchMatches = useCallback(async (reset = false) => {
        setLoading(true);
        setError(null);
        try {
            const currentCursor = reset ? null : cursor;
            const { data, nextCursor } = await getMatches(PAGE_SIZE, currentCursor || undefined);
            setCursor(nextCursor);
            setHasMore(Boolean(nextCursor));
            setMatches(prev => reset ? data : [...prev, ...data]);
        } catch (err: any) {
            setError(err.message || 'Failed to load matches');
        } finally {
            setLoading(false);
        }
    }, [cursor]);

    // Unmatch Action
    const onUnmatch = async (matchId: string) => {
        // 1. Optimistic Update
        setMatches(prev => prev.filter(m => m.id !== matchId));

        try {
            // 2. API Call
            await unmatchUser(matchId);
        } catch (err) {
            console.error("Failed to unmatch:", err);
            setError("Failed to unmatch");
            // Optionally fetchMatches() to restore
        }
    };

    // Block Action
    const onBlock = async (userId: string) => {
        // Blocking also removes the match, so filter it out
        // But we need to find which match has this user. 
        // Simplified: Just re-fetch or filter if we know the matchId too.

        try {
            await blockUser(userId);
            // Refresh list to be safe
            fetchMatches();
        } catch (err) {
            console.error("Failed to block:", err);
            setError("Failed to block user");
        }
    };

    return { matches, loading, error, hasMore, fetchMatches, onUnmatch, onBlock };
}
