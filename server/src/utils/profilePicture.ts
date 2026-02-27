import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { redis } from '../lib/redis.js';
import { BUCKET_NAME } from '../services/storage.service.js';

// Cache signed URLs for 25 minutes (URLs are valid for 30 min).
const CACHE_TTL_MS = 25 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = 30 * 60;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Strip the public URL prefix to get a clean storage path.
function toStoragePath(profilePicture: string): string {
  const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const idx = profilePicture.indexOf(publicPrefix);
  return idx >= 0 ? profilePicture.slice(idx + publicPrefix.length) : profilePicture;
}

// Normalize stored value to a storage path and return a short-lived signed URL.
export async function signProfilePicture(profilePicture?: string | null): Promise<string | null> {
  if (!profilePicture) return null;

  const path = toStoragePath(profilePicture);
  const redisKey = `image:signed:${path}`;

  // Return cached URL if still valid
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const redisCached = await redis.get(redisKey);
    if (redisCached) {
      signedUrlCache.set(path, {
        url: redisCached,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return redisCached;
    }
  } catch {
    // Redis is best-effort for this optimization.
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 1800); // 30 minutes

  if (error || !data?.signedUrl) {
    return null;
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  try {
    await redis.setex(redisKey, SIGNED_URL_TTL_SECONDS, data.signedUrl);
  } catch {
    // Redis is best-effort for this optimization.
  }

  return data.signedUrl;
}

// Invalidate cached signed URL when a user changes their profile picture.
export function invalidateSignedUrl(profilePicture?: string | null): void {
  if (!profilePicture) return;
  const path = toStoragePath(profilePicture);
  signedUrlCache.delete(path);
  redis.del(`image:signed:${path}`).catch(() => {});
}
