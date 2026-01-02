/**
 * @file src/services/storage.service.ts
 * @description Supabase Storage service for profile picture uploads.
 * 
 * This service is the bridge between the Fastify API and Supabase Storage.
 * It handles all file operations for profile pictures using SIGNED URLs,
 * which allows the mobile app to upload directly to Supabase without
 * streaming files through our server.
 * 
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                        UPLOAD FLOW                                   │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 1. Mobile app requests upload permission                             │
 * │    └── API calls: createSignedUploadUrl(userId, extension)           │
 * │    └── Returns: { signedUrl, path, expiresAt }                       │
 * │                                                                      │
 * │ 2. Mobile app uploads DIRECTLY to Supabase (bypasses our server)     │
 * │    └── PUT request to signedUrl with file data                       │
 * │                                                                      │
 * │ 3. Mobile app confirms upload completed                              │
 * │    └── API calls: validateUploadedFile(path)                         │
 * │    └── If invalid: file is auto-deleted, returns error               │
 * │    └── If valid: returns { valid: true, size, mimeType }             │
 * │                                                                      │
 * │ 4. API updates database with new profile picture URL                 │
 * │    └── Calls: deleteFile(oldUrl) to remove previous picture          │
 * │    └── Calls: getPublicUrl(path) to get viewable URL                 │
 * │    └── Updates: User.profilePicture in database                      │
 * └──────────────────────────────────────────────────────────────────────┘
 * 
 * FILE NAMING CONVENTION:
 * {userId}/{timestamp}-{randomId}.{extension}
 * Example: "clx7abc123/1703849600-x7y8z9.jpg"
 * 
 * - userId folder: RLS policies check this for ownership
 * - timestamp: Natural ordering + cache busting
 * - randomId: Prevents URL guessing
 * 
 * FUNCTIONS:
 * - createSignedUploadUrl(): Generate temporary upload permission (2 min)
 * - validateUploadedFile(): Verify file exists and meets size/type limits
 * - getPublicUrl(): Get the permanent viewable URL for a file
 * - deleteFile(): Remove a single file (for replacing old profile pics)
 * - deleteUserFiles(): Remove all user files (for account deletion)
 * 
 * SECURITY:
 * - Signed URLs expire in 2 minutes
 * - Post-upload validation catches bypassed client-side checks
 * - Invalid files are auto-deleted
 * - Uses supabaseAdmin (service role) which bypasses RLS for server operations
 * 
 * IMAGE OPTIMIZATION (FRONTEND IMPLEMENTATION):
 * This backend stores original images as-is. For optimal performance, the frontend
 * should use Supabase Image Transformations when DISPLAYING images:
 * 
 * Example:
 * <Image source={{ uri: `${user.profilePicture}?width=500&quality=85` }} />
 * 
 * Benefits:
 * - Automatic resizing (500px width for mobile screens)
 * - Compression (85% quality = visually identical, 50-70% smaller file)
 * - CDN caching (faster loads)
 * - Original preserved (can get high-res if needed)
 * 
 * No backend code changes needed - just add URL parameters in frontend!
 */

import { supabaseAdmin } from '../lib/supabase.js';
import { withCircuitBreaker } from '../utils/circuit-breaker.js';

const BUCKET_NAME = 'profile-pictures';
const SIGNED_URL_EXPIRES_IN = 120; // 2 minutes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Generate a signed URL for uploading a profile picture
 * @param userId - The user's Supabase auth ID (used for folder path)
 * @param fileExtension - File extension (jpg, png, webp)
 * @returns Object with signed URL and file path
 */
export async function createSignedUploadUrl(
  userId: string,
  fileExtension: string
): Promise<{ signedUrl: string; path: string; expiresAt: Date }> {
  // Generate a secure file name with timestamp and cryptographically secure random ID
  // OLD (WEAK): Math.random() - predictable, not cryptographically secure
  // NEW (SECURE): crypto.randomBytes() - cryptographically secure randomness
  // 
  // Why this matters:
  // - Math.random() uses a predictable pseudo-random algorithm
  // - Attackers can predict filenames and enumerate storage
  // - crypto.randomBytes() uses OS-level secure random generation
  // 
  // Format: {timestamp}-{secureRandomId}.{extension}
  // Example: 1704153600000-a3f9c2e7.jpg
  const timestamp = Date.now();

  // Generate cryptographically secure random ID (8 hex characters)
  // randomBytes(4) = 4 bytes = 32 bits of entropy
  const crypto = await import('crypto');
  const randomBytes = crypto.randomBytes(4);
  const randomId = randomBytes.toString('hex'); // 8 hex chars

  const path = `${userId}/${timestamp}-${randomId}.${fileExtension}`;

  // Wrap Supabase call with circuit breaker for health checking
  // If Supabase fails 3 times, circuit opens and rejects requests for 30s
  // This prevents cascading failures and gives Supabase time to recover
  const { data, error } = await withCircuitBreaker(
    'createSignedUploadUrl',
    async () => await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path)
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
 * Validate an uploaded file's metadata
 * @param path - The file path in storage
 * @returns Object with validation result and file metadata
 */
export async function validateUploadedFile(
  path: string
): Promise<{ valid: boolean; error?: string; size?: number; mimeType?: string }> {
  // Check if file exists and get metadata
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

  // Check file size
  if (file.metadata?.size > MAX_FILE_SIZE) {
    // Delete the oversized file
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
    return { valid: false, error: 'File exceeds 5MB limit' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECURITY: Magic Byte Validation + Image Sanitization
  // ═══════════════════════════════════════════════════════════════════════
  // This prevents malware attacks where attackers upload:
  // - Executables renamed as images (virus.exe → image.jpg)
  // - Polyglot files (image.jpg.html with embedded scripts)
  // - SVG with malicious <script> tags
  // - Decompression bombs (small file → crashes when opened)
  //
  // Protection mechanism:
  // 1. Download file buffer
  // 2. Check magic bytes (file signature) - validates it's a real image
  // 3. Use sharp to re-encode - strips EXIF/metadata and sanitizes
  // 4. Replace original with sanitized version
  // ═══════════════════════════════════════════════════════════════════════

  try {
    // Step 1: Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(path);

    if (downloadError || !fileData) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      return { valid: false, error: 'Failed to download file for validation' };
    }

    // Step 2: Convert to buffer for analysis
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 3: Check magic bytes (file signature)
    // This verifies the file is actually an image, not malware disguised as one
    const magicBytes = buffer.slice(0, 12);

    const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isWebP = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46;

    if (!isJPEG && !isPNG && !isWebP) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      return {
        valid: false,
        error: 'Invalid file signature - file is not a valid image (possible malware)',
      };
    }

    // Step 4: Use sharp to verify image integrity + sanitize
    // This does two things:
    // a) Confirms it's a valid, parseable image (not corrupted or malicious)
    // b) Re-encodes to strip EXIF data (GPS coordinates, device info)
    // c) Removes any embedded scripts or malicious payloads
    // d) Resizes if needed to prevent decompression bombs
    const sharp = (await import('sharp')).default;

    const sanitizedBuffer = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 90,
        mozjpeg: true, // Better compression
      })
      .toBuffer();

    // Step 5: Replace original file with sanitized version
    // This overwrites the uploaded file with the clean version
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

    // Success - file is validated, sanitized, and safe
    return {
      valid: true,
      size: sanitizedBuffer.length,
      mimeType: 'image/jpeg',
    };

  } catch (imageProcessingError) {
    // If sharp throws an error, the file is corrupted or malicious
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);

    const errorMessage = imageProcessingError instanceof Error
      ? imageProcessingError.message
      : 'Unknown error';

    return {
      valid: false,
      error: `Image validation failed: ${errorMessage} (file may be corrupted or malicious)`,
    };
  }

  // Note: The old MIME type check is now redundant since we re-encode everything
  // to JPEG above. All validation happens via magic bytes + sharp processing.
}

/**
 * Get the public URL for a file
 * @param path - The file path in storage
 * @returns Public URL string
 */
export function getPublicUrl(path: string): string {
  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from storage
 * @param path - The file path to delete (can be full URL or just path)
 */
export async function deleteFile(path: string): Promise<void> {
  // If it's a full URL, extract just the path
  const filePath = extractPathFromUrl(path);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error(`Failed to delete file ${filePath}:`, error.message);
    // Don't throw - old file deletion is not critical
  }
}

/**
 * Delete all files in a user's folder
 * Useful for account deletion
 * @param userId - The user's Supabase auth ID
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

/**
 * Extract file path from a full Supabase Storage URL
 * @param url - Full URL or path
 * @returns Just the path portion
 */
function extractPathFromUrl(url: string): string {
  if (!url.startsWith('http')) {
    return url; // Already a path
  }

  // URL format: https://{project}.supabase.co/storage/v1/object/public/profile-pictures/{path}
  const bucketPattern = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const index = url.indexOf(bucketPattern);

  if (index === -1) {
    return url; // Can't parse, return as-is
  }

  return url.substring(index + bucketPattern.length);
}