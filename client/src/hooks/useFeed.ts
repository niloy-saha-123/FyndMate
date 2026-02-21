/**
 * @file client/src/hooks/useFeed.ts
 * @description Custom hook to manage the Discovery Feed state and logic.
 *
 * RESPONSIBILITIES:
 * 1. Incremental loading: Fetch 5 first, load more as user swipes.
 * 2. Offline cache: Persist to AsyncStorage, show cached when offline.
 * 3. Swipe state, error handling, end-of-feed.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDiscoveryFeed,
  sendLike,
  UserProfile,
  LikesRateLimitError,
  LIKES_RATE_LIMIT,
  LIKES_RATE_LIMIT_WINDOW_HOURS,
} from '../services/matchingService';
import { getUserFriendlyErrorMessage } from '../utils/errorMessages';
import { ApiError } from '../lib/apiClient';

const FEED_CACHE_KEY = 'fyndmate_feed_cache';
const BATCH_SIZE = 5;
const LOAD_MORE_THRESHOLD = 2;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;
const SWIPE_MIN_INTERVAL_MS = 250;
const SWIPE_DUPLICATE_WINDOW_MS = 1200;
const SWIPE_DEBUG_ENABLED = process.env.EXPO_PUBLIC_DEBUG_SWIPE === '1';

type FeedCache = {
  profiles: UserProfile[];
  cursor: string | undefined;
  hasMore: boolean;
  timestamp: number;
};

export type SwipeError = {
  profileId: string;
  liked: boolean;
  message?: string;
  field?: string;
  errorMessage?: string;
};

function persistCache(profiles: UserProfile[], cursor: string | undefined, hasMore: boolean) {
  const payload: FeedCache = {
    profiles,
    cursor,
    hasMore,
    timestamp: Date.now(),
  };
  AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload)).catch(() => {});
}

async function loadCache(): Promise<FeedCache | null> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedCache;
    if (!parsed.profiles || !Array.isArray(parsed.profiles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useFeed() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [swipeError, setSwipeError] = useState<SwipeError | null>(null);
  const initialLoadDone = useRef(false);
  const fetchInFlightRef = useRef(false);
  const lastSwipeAtRef = useRef<number>(0);
  const lastSwipeProfileIdRef = useRef<string | null>(null);
  const swipeInFlightIdsRef = useRef<Set<string>>(new Set());

  const logSwipe = useCallback((meta: Record<string, unknown>) => {
    if (!SWIPE_DEBUG_ENABLED) return;
    const stack = new Error().stack;
    console.log('[swipe-debug]', { ...meta, stack });
  }, []);

  const fetchFeed = useCallback(
    async (reset = false) => {
      if (fetchInFlightRef.current) return;
      if (loading) return;
      if (!reset && !hasMore) return;
      fetchInFlightRef.current = true;

      try {
        if (reset) {
          setHasMore(true);
          setCursor(undefined);
        }
        const currentCursor = reset ? undefined : cursor;

        // Try cache first on initial load - show immediately, no loading spinner
        if (reset && !currentCursor) {
          const cached = await loadCache();
          if (cached && cached.profiles.length > 0) {
            setProfiles(cached.profiles);
            setCursor(cached.cursor);
            setHasMore(cached.hasMore);
            setError(null);
            // Fetch fresh in background (don't set loading - user sees cache)
          } else {
            setLoading(true);
          }
        } else {
          setLoading(true);
        }
        setError(null);

        let attempts = 0;
        let data: UserProfile[] = [];
        let lastError: unknown = null;

        while (attempts < MAX_ATTEMPTS) {
          try {
            data = await getDiscoveryFeed(BATCH_SIZE, currentCursor);
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            attempts += 1;
            if (attempts >= MAX_ATTEMPTS) break;
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempts));
          }
        }

        if (lastError) {
          // On fetch failure: use cache if we have it (offline)
          if (reset) {
            const cached = await loadCache();
            if (cached && cached.profiles.length > 0) {
              setProfiles(cached.profiles);
              setCursor(cached.cursor);
              setHasMore(cached.hasMore);
              setError(null);
              setLoading(false);
              return;
            }
          }
          setError(getUserFriendlyErrorMessage(lastError as Error));
          setLoading(false);
          return;
        }

        const newHasMore = data.length >= BATCH_SIZE;
        setHasMore(newHasMore);

        setProfiles((prev) => {
          const newList = reset ? data : [...prev, ...data];
          const newCursor = data.length > 0 ? data[data.length - 1].id : currentCursor;
          setCursor(newCursor);
          persistCache(newList, newCursor, newHasMore);
          return newList;
        });

        setLoading(false);
      } finally {
        fetchInFlightRef.current = false;
      }
    },
    [cursor, loading, hasMore]
  );

  // Load more when running low (called after swipe)
  const swipe = useCallback(
    async (
      likedId: string,
      liked: boolean,
      message?: string,
      source: 'skip_button' | 'request_modal' | 'retry' | 'unknown' = 'unknown'
    ) => {
      setSwipeError(null);

      const now = Date.now();
      const sinceLastSwipe = lastSwipeAtRef.current > 0
        ? now - lastSwipeAtRef.current
        : null;
      const topProfileId = profiles[0]?.id ?? null;

      logSwipe({
        event: 'swipe_invoked',
        likedId,
        liked,
        source,
        sinceLastSwipe,
        topProfileId,
      });

      if (sinceLastSwipe !== null && sinceLastSwipe < SWIPE_MIN_INTERVAL_MS) {
        logSwipe({ event: 'swipe_blocked_interval', likedId, source, sinceLastSwipe });
        return { matched: false, ignored: true };
      }

      if (
        lastSwipeProfileIdRef.current === likedId &&
        sinceLastSwipe !== null &&
        sinceLastSwipe < SWIPE_DUPLICATE_WINDOW_MS
      ) {
        logSwipe({ event: 'swipe_blocked_duplicate_profile', likedId, source, sinceLastSwipe });
        return { matched: false, ignored: true };
      }

      if (topProfileId && topProfileId !== likedId) {
        logSwipe({ event: 'swipe_blocked_stale_profile', likedId, source, topProfileId });
        return { matched: false, ignored: true };
      }

      if (swipeInFlightIdsRef.current.has(likedId)) {
        logSwipe({ event: 'swipe_blocked_inflight', likedId, source });
        return { matched: false, ignored: true };
      }

      lastSwipeAtRef.current = now;
      lastSwipeProfileIdRef.current = likedId;
      swipeInFlightIdsRef.current.add(likedId);

      const swipedProfile = profiles.find((p) => p.id === likedId);
      if (!swipedProfile) {
        swipeInFlightIdsRef.current.delete(likedId);
        logSwipe({ event: 'swipe_blocked_profile_missing', likedId, source });
        return { matched: false, ignored: true };
      }

      setProfiles((prev) => prev.filter((p) => p.id !== likedId));

      try {
        const result = await sendLike(likedId, liked, message);

        if (result.matched) {
          return { matched: true, match: result.match };
        }

        // Persist updated list (profile already removed above)
        const updated = profiles.filter((p) => p.id !== likedId);
        persistCache(updated, cursor, hasMore);

        // Load more when running low
        if (updated.length <= LOAD_MORE_THRESHOLD && hasMore && !loading) {
          fetchFeed(false);
        }

        return { matched: false };
      } catch (err) {
        setProfiles((prev) => [swipedProfile, ...prev]);

        if (err instanceof LikesRateLimitError) {
          Alert.alert(
            "Can't Send Request",
            `You've reached your daily limit of sending requests (${LIKES_RATE_LIMIT} per day).\n\nPlease try again in ${err.retryAfterHours} hour${err.retryAfterHours !== 1 ? 's' : ''}.`,
            [{ text: 'OK', style: 'default' }]
          );
          setError(`Daily limit reached (${LIKES_RATE_LIMIT}/${LIKES_RATE_LIMIT_WINDOW_HOURS}hr)`);
          return { matched: false, rateLimited: true };
        }

        const apiErr = err instanceof ApiError ? err : null;
        setSwipeError({
          profileId: likedId,
          liked,
          message,
          field: apiErr?.field,
          errorMessage: apiErr?.message ?? (err instanceof Error ? err.message : undefined),
        });
        return { matched: false, error: true };
      } finally {
        swipeInFlightIdsRef.current.delete(likedId);
      }
    },
    [profiles, cursor, hasMore, loading, fetchFeed, logSwipe]
  );

  const clearSwipeError = useCallback(() => setSwipeError(null), []);

  // Initial load: try cache first, then fetch
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    let mounted = true;

    (async () => {
      const cached = await loadCache();
      if (mounted && cached && cached.profiles.length > 0) {
        setProfiles(cached.profiles);
        setCursor(cached.cursor);
        setHasMore(cached.hasMore);
      }
      if (mounted) {
        fetchFeed(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { profiles, loading, error, hasMore, fetchFeed, swipe, swipeError, clearSwipeError };
}
