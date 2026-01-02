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
 * IMPORTANT - HEIC CONVERSION (FOR UI DEVELOPERS):
 * iPhones save photos as .heic by default, but our backend only accepts jpg/png/webp.
 * YOU MUST convert HEIC to JPEG before calling this service:
 * 
 * Example implementation in image picker:
 * ```typescript
 * import * as ImageManipulator from 'expo-image-manipulator';
 * 
 * const handleImagePick = async (pickedUri: string) => {
 *   let uri = pickedUri;
 *   
 *   // Auto-convert HEIC to JPEG
 *   if (uri.toLowerCase().endsWith('.heic')) {
 *     const result = await ImageManipulator.manipulateAsync(
 *       uri,
 *       [], // no transformations, just format conversion
 *       { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
 *     );
 *     uri = result.uri;
 *   }
 *   
 *   // Now upload the JPEG
 *   await uploadProfilePicture(uri, authToken);
 * };
 * ```
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * For @Mohdfaraz - IMAGE OPTIMIZATION IMPLEMENTATION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * STEP 1: Create Helper File
 * ─────────────────────────────
 * Create: client/src/utils/imageOptimization.ts
 * 
 * ```typescript
 * 
 * Optimize image URLs using Supabase Image Transformations
 * Add this to any profile picture URL before displaying
 * 
 * export const getOptimizedImageUrl = (
 * url: string | null | undefined,
 * width = 500,
 * quality = 85
  * ): string => {
 *   if (!url) return ''; // Return empty string if no URL
 *   return `${url}?width=${width}&quality=${quality}`;
 * };
 * ```
 * 
 * STEP 2: Use This Helper Everywhere You Display Profile Pictures
 * ─────────────────────────────────────────────────────────────────
 * Import and use in these files (when you create them):
 * 
 * 1. Profile Screen (app/(tabs)/profilePage.tsx)
 * ```tsx
  * import { getOptimizedImageUrl } from '@/utils/imageOptimization';
 * 
 * <Image 
 * source={ { uri: getOptimizedImageUrl(user.profilePicture) } } 
 * style={ styles.profilePicture }
 * />
  * ```
 * 
 * 2. Match/Swipe Cards (wherever you show user cards for swiping)
 * ```tsx
  * import { getOptimizedImageUrl } from '@/utils/imageOptimization';
 * 
 * <Image 
 * source={ { uri: getOptimizedImageUrl(matchedUser.profilePicture) } } 
 * style={ styles.cardImage }
 * />
  * ```
 * 
 * 3. Chat Screen (showing matched users in chat list)
 * ```tsx
  * import { getOptimizedImageUrl } from '@/utils/imageOptimization';
 * 
 * <Image 
 * source={ { uri: getOptimizedImageUrl(chatUser.profilePicture) } } 
 * style={ styles.avatar }
 * />
  * ```
 * 
 * 4. Likes Page (showing users who liked you)
 * ```tsx
  * import { getOptimizedImageUrl } from '@/utils/imageOptimization';
 * 
 * <Image 
 * source={ { uri: getOptimizedImageUrl(liker.profilePicture) } } 
 * style={ styles.thumbnail }
 * />
  * ```
 * 
 * DIFFERENT SIZES FOR DIFFERENT CONTEXTS:
 * You can pass different sizes for different use cases:
 * 
 * - Large profile view: getOptimizedImageUrl(url, 800, 90)
 * - Normal card: getOptimizedImageUrl(url, 500, 85)
 * - Small thumbnail: getOptimizedImageUrl(url, 200, 80)
 * 
 * BENEFITS:
 * - Automatic resizing (perfect for mobile screens)
 * - Compression (85% quality = visually identical, 50-70% smaller file)
 * - CDN caching (faster subsequent loads)
 * - Original preserved (can get high-res if needed)
 * - Saves bandwidth & improves app performance
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 *  PROFILE PICTURE REQUIREMENTS:
 * - Profile pictures are MANDATORY for all users (enforce during signup)
 * - Users can REPLACE their picture anytime (like Tinder)
 * - Users CANNOT delete their picture without replacing it
 * - UI should only show "Change Profile Picture" button, NOT "Delete"
 */

import pRetry from 'p-retry';

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
  return await pRetry(
    async () => {
      const response = await fetch('/api/upload/profile-picture/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken} `,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileExtension }),
      });

      if (!response.ok) {
        const error: UploadError = await response.json();
        throw new Error(error.details || error.error || 'Failed to request upload URL');
      }

      return await response.json();
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
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
      const response = await fetch('/api/upload/profile-picture/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken} `,
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
 * @param onProgress - Optional progress callback (DEPRECATED - see comments below)
 * @returns Public URL of uploaded profile picture
 *
 * @throws Error with descriptive message if any step fails
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * For @Mohdfaraz
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * The onProgress callback is available but currently NOT CALLED because
 * we removed the fake progress tracking. Here's what you should implement:
 * 
 * OPTION 1: Simple Loading Spinner (RECOMMENDED for MVP)
 * ─────────────────────────────────────────────────────────
 * Just show a spinner with "Uploading..." text. Simple and clean.
 * 
 * Example:
 * ```tsx
  * const [uploading, setUploading] = useState(false);
 * 
 * const handleUpload = async (uri) => {
 * setUploading(true);
 *   try {
 * await uploadProfilePicture(uri, token);
 *     // Success!
 *   } finally {
 * setUploading(false);
 *   }
 * };
 * 
 * return (
 * { uploading && <ActivityIndicator size= "large" />}
 * { uploading && <Text>Uploading your photo...</Text>}
 * );
 * ```
 * 
 * OPTION 2: Real Progress Bar (ADVANCED - do this later if you want)
 * ───────────────────────────────────────────────────────────────────
 * To show actual upload progress (10%, 20%, 30%...), you'll need to:
 * 
 * 1. Replace the fetch() calls in uploadToSupabase() with XMLHttpRequest
 * 2. Use xhr.upload.onprogress to track upload bytes
 * 3. Calculate percentage: (loaded / total) * 100
 * 
 * Example implementation (advanced):
 * ```typescript
  * // Inside uploadToSupabase function:
 * const xhr = new XMLHttpRequest();
 * 
 * xhr.upload.onprogress = (event) => {
 *   if (event.lengthComputable) {
 *     const percentComplete = (event.loaded / event.total) * 100;
 * onProgress?.('uploading', percentComplete);
 *   }
 * };
 * 
 * return new Promise((resolve, reject) => {
 * xhr.onload = () => resolve();
 * xhr.onerror = () => reject(new Error('Upload failed'));
 * xhr.open('PUT', signedUrl);
 * xhr.send(blob);
 * });
 * ```
 * 
 * Then in your UI:
 * ```tsx
  * const { upload } = useProfilePictureUpload(token);
 * const [progress, setProgress] = useState(0);
 * 
 * await upload(uri, (step, percent) => setProgress(percent));
 * 
 * return <ProgressBar progress={ progress } />;
 * ```
 * 
 * MY RECOMMENDATION (Kabbo):
 * Start with Option 1 (simple spinner). It's clean, works great, and
 * users don't really care about exact percentages. Add Option 2 later
 * if you feel fancy.
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
