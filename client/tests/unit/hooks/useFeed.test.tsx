import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple hook renderer
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

// Mock AsyncStorage with in-memory map
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

vi.mock('../../../src/services/matchingService', () => ({
  getDiscoveryFeed: (...args: any[]) => getDiscoveryFeed(...args),
  sendLike: (...args: any[]) => sendLike(...args),
}));

describe('useFeed', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    getDiscoveryFeed.mockResolvedValue([
      { id: 'u1', name: 'One' },
      { id: 'u2', name: 'Two' },
      { id: 'u3', name: 'Three' },
    ]);
    sendLike.mockResolvedValue({ matched: false });
  });

  it('loads feed and removes swiped profile', async () => {
    const { useFeed } = await import('../../../src/hooks/useFeed');
    const { result } = renderHook(() => useFeed());

    await act(async () => {
      await result().fetchFeed(true);
    });

    expect(result().profiles.map((p: any) => p.id)).toEqual(['u1', 'u2', 'u3']);

    await act(async () => {
      await result().swipe('u1', true, 'hello', 'request_modal');
    });

    expect(result().profiles.map((p: any) => p.id)).toEqual(['u2', 'u3']);
    expect(sendLike).toHaveBeenCalledWith('u1', true, 'hello');
  });

  it('serves cached feed when available', async () => {
    // Prime cache
    store.set(
      'fyndmate_feed_cache',
      JSON.stringify({
        profiles: [{ id: 'cached', name: 'Cached' }],
        cursor: undefined,
        hasMore: true,
        timestamp: Date.now(),
      })
    );

    // Simulate offline fetch so cache stays visible
    getDiscoveryFeed.mockRejectedValueOnce(new Error('offline'));

    const { useFeed } = await import('../../../src/hooks/useFeed');
    const { result } = renderHook(() => useFeed());

    // allow initial effect to run
    await act(async () => {});

    expect(result().profiles[0].id).toBe('cached');
  });
});
