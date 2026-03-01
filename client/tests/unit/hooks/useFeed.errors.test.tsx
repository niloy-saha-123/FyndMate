/**
 * @file tests/unit/hooks/useFeed.errors.test.tsx
 * @description Unit tests covering failure and retry paths in useFeed.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../../src/lib/apiClient';

// Minimal hook renderer (kept consistent with existing tests)
function renderHook<T>(hook: () => T) {
  let value: T;
  function Test() {
    value = hook();
    return null;
  }
  const inst = renderer.create(<Test />);
  return {
    result: () => value!,
    rerender: () => inst.update(<Test />),
    unmount: () => inst.unmount(),
  };
}

// In-memory cache mock
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, val: string) => {
      store.set(key, val);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  },
}));

const getDiscoveryFeed = vi.fn();
const sendLike = vi.fn();
class LikesRateLimitError extends Error {
  public retryAfter: number;
  public retryAfterHours: number;
  constructor(retryAfterSeconds: number, message?: string) {
    super(message);
    this.retryAfter = retryAfterSeconds;
    this.retryAfterHours = Math.ceil(retryAfterSeconds / 3600);
  }
}
vi.mock('../../../src/services/matchingService', () => ({
  getDiscoveryFeed: (...args: any[]) => getDiscoveryFeed(...args),
  sendLike: (...args: any[]) => sendLike(...args),
  LikesRateLimitError,
}));

describe('useFeed error handling', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('surfaces an error after exhausting retry attempts', async () => {
    // Fail twice to exercise retry loop
    getDiscoveryFeed.mockRejectedValueOnce(new Error('network down'));
    getDiscoveryFeed.mockRejectedValueOnce(new Error('still down'));

    const { useFeed } = await import('../../../src/hooks/useFeed');
    const { result } = renderHook(() => useFeed());

    await act(async () => {
      await result().fetchFeed(true);
    });

    expect(getDiscoveryFeed).toHaveBeenCalledTimes(2);
    expect(result().profiles).toEqual([]);
    // Hook normalizes to a user-friendly message
    expect(result().error).toMatch(/please try again/i);
  });

  it('records swipeError when API returns validation error', async () => {
    getDiscoveryFeed.mockResolvedValue([{ id: 'p1', name: 'One' }]);
    const apiError = new ApiError('Bad intro', 400, 'message');
    sendLike.mockRejectedValue(apiError);

    const { useFeed } = await import('../../../src/hooks/useFeed');
    const { result } = renderHook(() => useFeed());

    await act(async () => {
      await result().fetchFeed(true);
    });

    await act(async () => {
      await result().swipe('p1', true, 'hi', 'request_modal');
    });

    expect(result().swipeError?.profileId).toBe('p1');
    expect(result().swipeError?.field).toBe('message');
    expect(result().profiles[0].id).toBe('p1'); // profile restored after failure
  });
});
