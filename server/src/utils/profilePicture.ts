import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { BUCKET_NAME } from '../services/storage.service.js';

// Normalize stored value to a storage path and return a short-lived signed URL.
export async function signProfilePicture(profilePicture?: string | null): Promise<string | null> {
  if (!profilePicture) return null;

  // If a full public URL was stored, strip the public prefix to get the path.
  const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const idx = profilePicture.indexOf(publicPrefix);
  const path = idx >= 0 ? profilePicture.slice(idx + publicPrefix.length) : profilePicture;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 300); // 5 minutes

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
