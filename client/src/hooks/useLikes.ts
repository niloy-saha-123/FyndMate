/**
 * @file client/src/hooks/useLikes.ts
 * @description Custom hook to manage the "Likes Section" (Inbox) state.
 * 
 * RESPONSIBILITIES:
 * 1. Fetching Incoming Likes (People who liked you).
 * 2. Accepting Likes (Creating Matches).
 * 3. Declining Likes (Removing them).
 * 
 * NOTE: Token is automatically attached via apiClient from auth context.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReceivedLikes, acceptLike, declineLike, Like } from '../services/matchingService';
import { getUserFriendlyErrorMessage } from '../utils/errorMessages';

export const LIKES_CACHE_KEY = 'fyndmate_likes_cache';

type LikesCache = {
    likes: Like[];
    timestamp: number;
};

async function loadLikesCache(): Promise<Like[] | null> {
    try {
        const raw = await AsyncStorage.getItem(LIKES_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LikesCache;
        return Array.isArray(parsed.likes) ? parsed.likes : null;
    } catch {
        return null;
    }
}

function persistLikesCache(likes: Like[]) {
    const payload: LikesCache = {
        likes,
        timestamp: Date.now(),
    };
    AsyncStorage.setItem(LIKES_CACHE_KEY, JSON.stringify(payload)).catch(() => {});
}

export function useLikes() {
    const [likes, setLikes] = useState<Like[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initialCacheLoaded = useRef(false);

    // Fetch Likes
    const fetchLikes = useCallback(async (options?: { silent?: boolean }) => {
        const silent = Boolean(options?.silent);
        if (!silent) {
            setLoading(true);
        }
        setError(null);
        try {
            const data = await getReceivedLikes();
            setLikes(data);
            persistLikesCache(data);
        } catch (err: any) {
            setError(getUserFriendlyErrorMessage(err));
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (initialCacheLoaded.current) return;
        initialCacheLoaded.current = true;

        let mounted = true;
        (async () => {
            const cached = await loadLikesCache();
            if (mounted && cached && cached.length > 0) {
                setLikes(cached);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    // Accept Action (Reply & Match)
    const onAccept = async (likeId: string, replyMessage?: string) => {
        // 1. Optimistic Update: Remove from list
        setLikes(prev => {
            const next = prev.filter(l => l.id !== likeId);
            persistLikesCache(next);
            return next;
        });

        try {
            // 2. API Call
            const match = await acceptLike(likeId, replyMessage);

            // 3. Success Feedback
            // Return match so UI can navigate to messages or show toast
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
        setLikes(prev => {
            const next = prev.filter(l => l.id !== likeId);
            persistLikesCache(next);
            return next;
        });

        try {
            // 2. API Call
            await declineLike(likeId);
        } catch (err) {
            console.error("Failed to decline like:", err);
            setError("Failed to decline");
            // Revert?
        }
    };

    return { likes, loading, error, fetchLikes, onAccept, onDecline };
}
