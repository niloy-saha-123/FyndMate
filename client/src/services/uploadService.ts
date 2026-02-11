/**
 * @file client/src/services/uploadService.ts
 * @description Client-side service for profile picture uploads
 *
 * This service handles the 3-step upload process:
 * 1. Request signed upload URL from server
 * 2. Upload file directly to Supabase Storage
 * 3. Confirm upload and get final URL
 *
 * Uses fetch API for server communication and direct upload to Supabase.
 * Includes automatic retry logic for network failures.
 * 
 * IMAGE OPTIMIZATION:
 * Use the helper functions in src/utils/imageOptimization.ts to optimize
 * image URLs before displaying them. This uses Supabase Image Transformations
 * for automatic resizing and compression.
 * 
 * HEIC CONVERSION:
 * iPhones save photos as .heic by default, but our backend only accepts jpg/png/webp.
 * Convert HEIC to JPEG before calling this service using expo-image-manipulator.
 * 
 * PROFILE PICTURE REQUIREMENTS:
 * - Profile pictures are MANDATORY for all users (enforce during signup)
 * - Users can REPLACE their picture anytime
 * - Users CANNOT delete their picture without replacing it
 * - UI should only show "Change Profile Picture" button, NOT "Delete"
 */

import pRetry from 'p-retry';
import { getApiBaseUrl } from '../lib/apiClient';

// API base URL - use centralized resolver for consistent localhost handling
const API_BASE_URL = getApiBaseUrl();

export interface UploadRequestResponse {
  signedUrl: string;
  uploadPath: string;
  expiresAt: string;
  remainingUploads: number;
}

export interface UploadConfirmResponse {
  publicUrl: string;
  message: string;
}

export interface UploadError {
  error: string;
  details?: string;
  remainingUploads?: number;
  retryAfter?: number;
}

/**
 * Custom error class for rate limit exceeded
 * Contains retry information for UI display
 */
export class RateLimitError extends Error {
  public retryAfter: number;
  public retryAfterMinutes: number;

  constructor(retryAfterSeconds: number, message?: string) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(message || `Rate limit exceeded. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfterSeconds;
    this.retryAfterMinutes = minutes;
  }
}

/**
 * Extract file extension from image URI
 * Supports common formats: jpg, jpeg, png, webp
 */
function getFileExtension(imageUri: string): string {
  const extension = imageUri.split('.').pop()?.toLowerCase();

  // Normalize common variants
  if (extension === 'jpeg') return 'jpg';

  // Validate supported extensions
  const supported = ['jpg', 'png', 'webp'];
  if (!extension || !supported.includes(extension)) {
    throw new Error(`Unsupported file format.Supported: ${supported.join(', ')} `);
  }

  return extension;
}

/**
 * Request a signed upload URL from the server
 * Includes automatic retry logic (3 attempts) for network failures
 * 
 * @param fileExtension - File extension (jpg, png, webp)
 * @param authToken - User's JWT token
 * @returns Upload request response with signed URL
 */
export async function requestUploadUrl(
  fileExtension: string,
  authToken: string
): Promise<UploadRequestResponse> {
  // Retry network requests up to 3 times with exponential backoff
  // This handles temporary network issues (WiFi drops, 4G->WiFi switches, etc.)
  // NOTE: 429 rate limit errors are NOT retried - they are thrown immediately
  return await pRetry(
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/upload/profile-picture/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileExtension }),
      });

      // Handle rate limiting (429) - do not retry, throw immediately
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 3600;
        throw new RateLimitError(retryAfterSeconds);
      }

      if (!response.ok) {
        const error: UploadError = await response.json();
        throw new Error(error.details || error.error || 'Failed to request upload URL');
      }

      return await response.json();
    },
    {
      retries: 3,
      // Don't retry rate limit errors
      shouldRetry: (error) => !(error instanceof RateLimitError),
      onFailedAttempt: (error) => {
        // Skip logging for rate limit errors (they won't be retried anyway)
        if (error instanceof RateLimitError) return;
        console.log(
          `Request upload URL attempt ${error.attemptNumber} failed. ` +
          `${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

/**
 * Upload file directly to Supabase Storage using signed URL
 * Includes automatic retry logic (3 attempts) for network failures
 * 
 * @param signedUrl - Pre-signed upload URL from server
 * @param imageUri - Local image URI from image picker
 * @returns Upload success confirmation
 */
export async function uploadToSupabase(
  signedUrl: string,
  imageUri: string
): Promise<void> {
  // Retry file upload up to 3 times
  // This is critical for mobile apps where network can be unreliable
  return await pRetry(
    async () => {
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase using signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText} `);
      }
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(
          `File upload attempt ${error.attemptNumber} failed. ` +
          `${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

/**
 * Confirm upload completion and get final public URL
 * Includes automatic retry logic (3 attempts) for network failures
 * 
 * @param uploadPath - Path returned from request step
 * @param authToken - User's JWT token
 * @returns Final public URL and success message
 */
export async function confirmUpload(
  uploadPath: string,
  authToken: string
): Promise<UploadConfirmResponse> {
  // Retry confirmation request up to 3 times
  return await pRetry(
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/upload/profile-picture/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadPath }),
      });

      if (!response.ok) {
        const error: UploadError = await response.json();
        throw new Error(error.details || error.error || 'Failed to confirm upload');
      }

      return await response.json();
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(
          `Confirm upload attempt ${error.attemptNumber} failed. ` +
          `${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

/**
 * Complete profile picture upload process
 * Combines all 3 steps: request → upload → confirm
 *
 * @param imageUri - Image URI from image picker (e.g., from Expo ImagePicker)
 * @param authToken - User's JWT token
 * @param onProgress - Optional progress callback for tracking upload steps
 * @returns Public URL of uploaded profile picture
 *
 * @throws Error with descriptive message if any step fails
 * 
 * Usage with useProfilePictureUpload hook (recommended):
 * ```tsx
 * const { upload, uploading, error } = useProfilePictureUpload();
 * 
 * const handleUpload = async (uri: string) => {
 *   try {
 *     const publicUrl = await upload(uri);
 *     console.log('Uploaded:', publicUrl);
 *   } catch (err) {
 *     console.error('Upload failed:', err);
 *   }
 * };
 * ```
 */
export async function uploadProfilePicture(
  imageUri: string,
  authToken: string,
  onProgress?: (step: string, progress: number) => void
): Promise<string> {
  try {
    // Step 1: Extract file extension and validate
    const fileExtension = getFileExtension(imageUri);

    // Step 2: Request signed upload URL
    // (Kabbo: This is very fast, ~100-200ms)
    const uploadRequest = await requestUploadUrl(fileExtension, authToken);

    // Step 3: Upload file to Supabase
    // (Kabbo: This is the slow part, 1-3 seconds depending on image size and network)
    await uploadToSupabase(uploadRequest.signedUrl, imageUri);

    // Step 4: Confirm upload and get final URL
    // (Kabbo: Fast again, ~200-400ms)
    const confirmation = await confirmUpload(uploadRequest.uploadPath, authToken);

    return confirmation.publicUrl;

  } catch (error) {
    // Re-throw with better error messages
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Upload failed with unknown error');
  }
}

/**
 * Validate image before upload
 * Basic client-side checks (server does final validation)
 *
 * @param imageUri - Image URI to validate
 * @returns Validation result
 */
export async function validateImage(imageUri: string): Promise<{
  valid: boolean;
  error?: string;
  size?: number;
}> {
  try {
    // Check file extension
    getFileExtension(imageUri); // Will throw if invalid

    // Check file size (approximate from URI response)
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const sizeInMB = blob.size / (1024 * 1024);

    if (sizeInMB > 5) {
      return { valid: false, error: 'Image file is too large (max 5MB)' };
    }

    return { valid: true, size: blob.size };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid image file'
    };
  }
}