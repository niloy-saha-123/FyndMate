import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by expo-secure-store (Keychain / EncryptedSharedPreferences)
 * rather than AsyncStorage, so refresh tokens are never written to plaintext disk.
 *
 * SecureStore warns (and on some Android devices fails) for values larger than
 * 2048 bytes. A Supabase session comfortably exceeds that once the access token
 * and user metadata are included, so values are transparently split across
 * numbered chunk keys.
 *
 * Layout for a chunked value stored under `key`:
 *   key      -> "__chunked__:<count>"
 *   key.0    -> first slice
 *   key.1    -> second slice
 *   ...
 * Values small enough to fit are written directly to `key` with no header.
 */

/**
 * Maximum UTF-8 *bytes* per slice, kept under the 2048-byte threshold. Slicing is
 * measured in bytes rather than string length because a single character can
 * occupy up to 4 UTF-8 bytes -- budgeting by `String.length` overflows the limit
 * on non-Latin content such as a CJK display name.
 */
const MAX_CHUNK_BYTES = 1800;

const CHUNK_HEADER_PREFIX = '__chunked__:';

/** UTF-8 byte length of a single code point. */
function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

function utf8ByteLength(value: string): number {
  let total = 0;
  for (const char of value) {
    total += utf8Length(char.codePointAt(0)!);
  }
  return total;
}

/**
 * Splits on code-point boundaries so a surrogate pair is never cut in half --
 * a lone surrogate would be mangled when the native layer re-encodes it as UTF-8.
 * Concatenating the result reproduces the input exactly.
 */
function splitByUtf8Bytes(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const charBytes = utf8Length(char.codePointAt(0)!);
    if (currentBytes + charBytes > maxBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }

  if (current !== '') chunks.push(current);
  return chunks;
}

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

/** Returns the chunk count if `raw` is a chunk header, otherwise null. */
function parseChunkHeader(raw: string): number | null {
  if (!raw.startsWith(CHUNK_HEADER_PREFIX)) return null;
  const count = Number(raw.slice(CHUNK_HEADER_PREFIX.length));
  if (!Number.isInteger(count) || count < 1) return null;
  return count;
}

async function removeItem(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head !== null) {
    const count = parseChunkHeader(head);
    if (count !== null) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const head = await SecureStore.getItemAsync(key);
      if (head === null) return null;

      const count = parseChunkHeader(head);
      if (count === null) return head;

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        // A missing slice means the write was torn or partially evicted. Treat
        // the whole entry as absent so Supabase falls back to a fresh sign-in
        // instead of parsing truncated JSON.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    } catch {
      // Never let a keychain error escape into Supabase's auth bootstrap --
      // a hard throw here leaves the app stuck on the loading screen.
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Clear any previous entry first so stale chunks from a longer prior
      // value can't survive and corrupt the next read.
      await removeItem(key);

      if (utf8ByteLength(value) <= MAX_CHUNK_BYTES) {
        await SecureStore.setItemAsync(key, value);
        return;
      }

      const chunks = splitByUtf8Bytes(value, MAX_CHUNK_BYTES);
      const count = chunks.length;
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
      }
      // Header written last: if we crash mid-write, `key` is absent and the
      // entry reads as missing rather than as a header pointing at short data.
      await SecureStore.setItemAsync(key, `${CHUNK_HEADER_PREFIX}${count}`);
    } catch (error) {
      console.error('[auth-storage] Failed to persist session', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await removeItem(key);
    } catch (error) {
      console.error('[auth-storage] Failed to clear session', error);
    }
  },
};
