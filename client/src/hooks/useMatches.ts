/**
 * @file client/src/hooks/useMatches.ts
 * @description Custom hook to manage the Active Matches (Chats) state.
 * 
 * RESPONSIBILITIES:
 * 1. Fetching Active Matches.
 * 2. Unmatching users.
 * 3. Blocking users (optional, usually done in chat settings).
 */

import { useState, useEffect, useCallback } from 'react';
import { getMatches, unmatchUser, blockUser, Match } from '../services/matchingService';

export function useMatches(token: string) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Matches
    const fetchMatches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getMatches(token);
            setMatches(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load matches');
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Unmatch Action
    const onUnmatch = async (matchId: string) => {
        // 1. Optimistic Update
        setMatches(prev => prev.filter(m => m.id !== matchId));

        try {
            // 2. API Call
            await unmatchUser(token, matchId);
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
            await blockUser(token, userId);
            // Refresh list to be safe
            fetchMatches();
        } catch (err) {
            console.error("Failed to block:", err);
            setError("Failed to block user");
        }
    };

    return { matches, loading, error, fetchMatches, onUnmatch, onBlock };
}
