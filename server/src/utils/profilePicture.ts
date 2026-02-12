import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { BUCKET_NAME } from '../services/storage.service.js';

// Cache signed URLs for 25 minutes (URLs are valid for 30 min).
const CACHE_TTL_MS = 25 * 60 * 1000;
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

  // Return cached URL if still valid
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
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

  return data.signedUrl;
}

// Invalidate cached signed URL when a user changes their profile picture.
export function invalidateSignedUrl(profilePicture?: string | null): void {
  if (!profilePicture) return;
  signedUrlCache.delete(toStoragePath(profilePicture));
}
