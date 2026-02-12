/**
 * @file src/services/storage.service.ts
 * @description Manages profile picture uploads via Supabase Storage using signed URLs.
 * Handles secure file uploads, validation, image sanitization/optimization, and cleanup.
 */

import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { withCircuitBreaker } from '../utils/circuit-breaker.js';

export const BUCKET_NAME = 'profile-pictures';
const DELETED_ACCOUNTS_PREFIX = 'deleted-accounts';
const SIGNED_URL_EXPIRES_IN = 120; // 2 minutes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// TODO [POST-MVP]: Make bucket private and serve via short-lived signed GET URLs/CDN token instead of public reads.
// TODO [POST-MVP]: Stream file validation instead of buffering entire file to reduce memory spikes during uploads.

/**
 * Generate a signed URL for uploading a profile picture.
 * Uses cryptographically secure random values for filenames.
 */
export async function createSignedUploadUrl(
  userId: string,
  fileExtension: string
): Promise<{ signedUrl: string; path: string; expiresAt: Date }> {
  const timestamp = Date.now();
  const crypto = await import('crypto');
  const randomBytes = crypto.randomBytes(16); // increase entropy to reduce path guessing
  const randomId = randomBytes.toString('hex');

  const path = `${userId}/${timestamp}-${randomId}.${fileExtension}`;

  // Define specific response type to handle both Supabase and generic errors
  type StorageResponse = {
    data: { signedUrl: string; path: string } | null;
    error: { message: string } | null;
  };

  // Circuit breaker protects against Supabase outages
  // Wrap Supabase call with circuit breaker for health checking
  const { data, error } = await withCircuitBreaker<StorageResponse>(
    'createSignedUploadUrl',
    async () => await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path),
    () => ({ data: null, error: new Error('Service temporarily unavailable') })
  );

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRES_IN * 1000);

  return {
    signedUrl: data.signedUrl,
    path: data.path,
    expiresAt,
  };
}

/**
 * Validate an uploaded file's metadata and content integrity.
 * Performs checks for file size, existence, and malicious content (magic bytes).
 */
export async function validateUploadedFile(
  path: string
): Promise<{ valid: boolean; error?: string; size?: number; mimeType?: string }> {
  // Verify file existence in storage
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(path.split('/')[0], {
      limit: 100,
      search: path.split('/')[1],
    });

  if (listError) {
    return { valid: false, error: `Failed to verify file: ${listError.message}` };
  }

  const fileName = path.split('/')[1];
  const file = files?.find((f) => f.name === fileName);

  if (!file) {
    return { valid: false, error: 'File not found in storage' };
  }

  if (file.metadata?.size > MAX_FILE_SIZE) {
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
    return { valid: false, error: 'File exceeds 5MB limit' };
  }

  // Security: Image Sanitization & Integrity Check
  try {
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(path);

    if (downloadError || !fileData) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      return { valid: false, error: 'Failed to download file for validation' };
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate Magic Bytes
    const magicBytes = buffer.slice(0, 12);
    const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isWebP = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46;

    if (!isJPEG && !isPNG && !isWebP) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      return {
        valid: false,
        error: 'Invalid file signature - file is not a valid image',
      };
    }

    // Sanitize and re-encode using Sharp
    const sharp = (await import('sharp')).default;
    const sanitizedBuffer = await sharp(buffer)
      .rotate()
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();

    // Overwrite original with sanitized version
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(path, sanitizedBuffer, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (uploadError) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      return { valid: false, error: 'Failed to sanitize image' };
    }

    return {
      valid: true,
      size: sanitizedBuffer.length,
      mimeType: 'image/jpeg',
    };

  } catch (imageProcessingError) {
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);

    const errorMessage = imageProcessingError instanceof Error
      ? imageProcessingError.message
      : 'Unknown error';

    return {
      valid: false,
      error: `Image validation failed: ${errorMessage}`,
    };
  }
}

/**
 * Get the public URL for a file.
 */
export function getPublicUrl(path: string): string {
  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const filePath = extractPathFromUrl(path);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error(`Failed to delete file ${filePath}:`, error.message);
  }
}

/**
 * Delete all files in a user's folder.
 */
export async function deleteUserFiles(userId: string): Promise<void> {
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(userId);

  if (listError || !files?.length) {
    return;
  }

  const filePaths = files.map((file) => `${userId}/${file.name}`);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove(filePaths);

  if (error) {
    console.error(`Failed to delete user files for ${userId}:`, error.message);
  }
}

type QuarantineMove = {
  sourcePath: string;
  quarantinePath: string;
};

type QuarantineFailure = {
  sourcePath: string;
  reason: string;
};

export type QuarantineMoveResult = {
  moved: QuarantineMove[];
  failed: QuarantineFailure[];
};

function buildQuarantinePath(deletionReference: string, sourcePath: string): string {
  const timestamp = Date.now();
  const safeSource = sourcePath.replace(/\//g, '__');
  return `${DELETED_ACCOUNTS_PREFIX}/${deletionReference}/${timestamp}-${safeSource}`;
}

/**
 * Convert profile-picture URL or relative path into a storage path.
 */
export function toStoragePath(pathOrUrl: string): string {
  return extractPathFromUrl(pathOrUrl);
}

/**
 * Move a single file path (or URL) into quarantine for delayed deletion.
 */
export async function moveStoragePathToQuarantine(
  pathOrUrl: string,
  deletionReference: string
): Promise<QuarantineMoveResult> {
  const sourcePath = toStoragePath(pathOrUrl);
  if (!sourcePath) {
    return { moved: [], failed: [] };
  }

  const quarantinePath = buildQuarantinePath(deletionReference, sourcePath);
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .move(sourcePath, quarantinePath);

  if (error) {
    return {
      moved: [],
      failed: [{ sourcePath, reason: error.message }],
    };
  }

  return {
    moved: [{ sourcePath, quarantinePath }],
    failed: [],
  };
}

/**
 * Move all files in a user's profile-picture folder to quarantine.
 */
export async function moveUserFilesToQuarantine(
  userId: string,
  deletionReference: string
): Promise<QuarantineMoveResult> {
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(userId);

  if (listError || !files?.length) {
    return {
      moved: [],
      failed: listError ? [{ sourcePath: `${userId}/*`, reason: listError.message }] : [],
    };
  }

  const moved: QuarantineMove[] = [];
  const failed: QuarantineFailure[] = [];

  for (const file of files) {
    const sourcePath = `${userId}/${file.name}`;
    const quarantinePath = buildQuarantinePath(deletionReference, sourcePath);

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .move(sourcePath, quarantinePath);

    if (error) {
      failed.push({ sourcePath, reason: error.message });
      continue;
    }

    moved.push({ sourcePath, quarantinePath });
  }

  return { moved, failed };
}

/**
 * Extract relative file path from a full URL.
 */
function extractPathFromUrl(url: string): string {
  if (!url.startsWith('http')) {
    return url;
  }

  const bucketPattern = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const index = url.indexOf(bucketPattern);

  if (index === -1) {
    return url;
  }

  return url.substring(index + bucketPattern.length);
}
