/**
 * @file client/src/hooks/useLikes.ts
 * @description Custom hook to manage the "Likes Section" (Inbox) state.
 * 
 * RESPONSIBILITIES:
 * 1. Fetching Incoming Likes (People who liked you).
 * 2. Accepting Likes (Creating Matches).
 * 3. Declining Likes (Removing them).
 */

import { useState, useEffect, useCallback } from 'react';
import { getReceivedLikes, acceptLike, declineLike, Like, Match } from '../services/matchingService';

export function useLikes(token: string) {
    const [likes, setLikes] = useState<Like[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Likes
    const fetchLikes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getReceivedLikes(token);
            setLikes(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load likes');
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Accept Action (Reply & Match)
    const onAccept = async (likeId: string, replyMessage?: string) => {
        // 1. Optimistic Update: Remove from list
        setLikes(prev => prev.filter(l => l.id !== likeId));

        try {
            // 2. API Call
            const match = await acceptLike(token, likeId, replyMessage);

            // 3. Success Feedback
            // Return match so UI can navigate to chat or show toast
            return match;
        } catch (err) {
            console.error("Failed to accept like:", err);
            // Revert optimistic update on failure?
            setError("Failed to create match");
            // Optionally re-fetch
            fetchLikes();
        }
    };

    // Decline Action (Pass)
    const onDecline = async (likeId: string) => {
        // 1. Optimistic Update: Remove from list
        setLikes(prev => prev.filter(l => l.id !== likeId));

        try {
            // 2. API Call
            await declineLike(token, likeId);
        } catch (err) {
            console.error("Failed to decline like:", err);
            setError("Failed to decline");
            // Revert?
        }
    };

    return { likes, loading, error, fetchLikes, onAccept, onDecline };
}
