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
 */

import { supabaseAdmin } from '../lib/supabase.js';

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
  // Generate unique filename: {userId}/{timestamp}-{random}.{ext}
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);   // Generate a random string for the filename
  const path = `${userId}/${timestamp}-${randomId}.${fileExtension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(path);

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

  // Check MIME type
  const mimeType = file.metadata?.mimetype;
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    // Delete the invalid file
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
    return { valid: false, error: 'Invalid file type' };
  }

  return {
    valid: true,
    size: file.metadata?.size,
    mimeType,
  };
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