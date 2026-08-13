import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory stand-in for the native keychain, isolated to this file so it
// cannot leak state into the shared expo-secure-store mock.
const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => (store.has(key) ? store.get(key)! : null),
  setItemAsync: async (key: string, value: string) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    store.delete(key);
  },
}));

const { secureSessionStorage } = await import('../../../src/auth/secureSessionStorage');

const KEY = 'sb-abcdefg-auth-token';

describe('secureSessionStorage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('returns null for a key that was never written', async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('round-trips a small value without chunking', async () => {
    await secureSessionStorage.setItem(KEY, '{"access_token":"short"}');

    expect(await secureSessionStorage.getItem(KEY)).toBe('{"access_token":"short"}');
    // Stored inline, so no chunk keys should exist.
    expect([...store.keys()]).toEqual([KEY]);
  });

  it('round-trips a value larger than the SecureStore 2048-byte limit', async () => {
    const session = JSON.stringify({
      access_token: 'a'.repeat(3000),
      refresh_token: 'r'.repeat(500),
      user: { id: 'user-1', name: 'Ada Lovelace' },
    });

    await secureSessionStorage.setItem(KEY, session);

    expect(await secureSessionStorage.getItem(KEY)).toBe(session);
    // Every physical slice must stay under the native size limit.
    for (const [k, v] of store) {
      if (k === KEY) continue;
      expect(Buffer.byteLength(v, 'utf8')).toBeLessThanOrEqual(2048);
    }
  });

  it('round-trips multibyte content without corruption', async () => {
    const session = JSON.stringify({
      access_token: 'z'.repeat(2500),
      user: { name: '日本語のなまえ'.repeat(80) },
    });

    await secureSessionStorage.setItem(KEY, session);

    expect(await secureSessionStorage.getItem(KEY)).toBe(session);
    for (const [k, v] of store) {
      if (k === KEY) continue;
      expect(Buffer.byteLength(v, 'utf8')).toBeLessThanOrEqual(2048);
    }
  });

  it('does not leave stale chunks when a long value is replaced by a short one', async () => {
    await secureSessionStorage.setItem(KEY, 'x'.repeat(5000));
    await secureSessionStorage.setItem(KEY, 'small');

    expect(await secureSessionStorage.getItem(KEY)).toBe('small');
    expect([...store.keys()]).toEqual([KEY]);
  });

  it('reports a torn write as absent rather than returning truncated data', async () => {
    await secureSessionStorage.setItem(KEY, 'y'.repeat(5000));
    // Simulate one slice going missing (partial eviction / interrupted write).
    store.delete(`${KEY}.1`);

    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('removes the header and every chunk on removeItem', async () => {
    await secureSessionStorage.setItem(KEY, 'q'.repeat(5000));
    await secureSessionStorage.removeItem(KEY);

    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    expect(store.size).toBe(0);
  });

  it('still reads a plain value written before chunking existed', async () => {
    store.set(KEY, '{"legacy":true}');

    expect(await secureSessionStorage.getItem(KEY)).toBe('{"legacy":true}');
  });
});
