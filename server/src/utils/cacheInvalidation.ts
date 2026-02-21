import { redis } from '../lib/redis.js';

const SCAN_COUNT = 100;

async function scanKeys(pattern: string): Promise<string[]> {
  let cursor = '0';
  const keys: string[] = [];

  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      SCAN_COUNT.toString()
    );
    cursor = nextCursor;
    if (batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');

  return keys;
}

export async function invalidateFeedCacheForUsers(userIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const keysToDelete = new Set<string>();
  for (const userId of uniqueIds) {
    // Backward-compatible legacy key + v2 patterned keys.
    keysToDelete.add(`feed:${userId}`);
    const matched = await scanKeys(`feed:${userId}:*`);
    for (const key of matched) keysToDelete.add(key);
  }

  if (keysToDelete.size === 0) return;
  await redis.del(...Array.from(keysToDelete));
}

export async function invalidateAllFeedCache(): Promise<void> {
  const keys = await scanKeys('feed:*');
  if (keys.length === 0) return;
  await redis.del(...keys);
}

export async function invalidateProfileViewCacheForProfile(profileId: string): Promise<void> {
  if (!profileId) return;

  const keys = await scanKeys(`profile:view:*:${profileId}`);
  if (keys.length === 0) return;

  await redis.del(...keys);
}
