/**
 * @file client/src/hooks/useProfilePictureUpload.ts
 * @description React hook for profile picture uploads
 *
 * Provides upload state management, progress tracking, and error handling.
 * Integrates with uploadService.ts for the actual upload logic.
 * Token is automatically sourced from AuthProvider context.
 *
 * Usage:
 * ```tsx
 * const { upload, uploading, progress, error, reset } = useProfilePictureUpload();
 *
 * const handleUpload = async (imageUri: string) => {
 *   try {
 *     const publicUrl = await upload(imageUri);
 *     console.log('Uploaded:', publicUrl);
 *   } catch (err) {
 *     console.error('Upload failed:', err);
 *   }
 * };
 * ```
 */

import { useState, useCallback, useEffect } from 'react';
import { uploadProfilePicture, validateImage, RateLimitError } from '../services/uploadService';
import { useAuth } from '../auth/AuthProvider';

export interface UploadProgress {
  step: string;
  progress: number;
}

export interface RateLimitState {
  isLimited: boolean;
  retryAfterSeconds: number;
  retryAfterMinutes: number;
  resetTime: Date | null;
}

export interface UploadHookState {
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  lastUploadUrl: string | null;
  rateLimit: RateLimitState;
}

/**
 * Hook for managing profile picture upload state and operations
 * Token is automatically sourced from AuthProvider - no need to pass it manually.
 *
 * @returns Upload functions and state
 */
export function useProfilePictureUpload() {
  const { accessToken } = useAuth();
  
  const [state, setState] = useState<UploadHookState>({
    uploading: false,
    progress: null,
    error: null,
    lastUploadUrl: null,
    rateLimit: {
      isLimited: false,
      retryAfterSeconds: 0,
      retryAfterMinutes: 0,
      resetTime: null,
    },
  });

  // Auto-clear rate limit when timer expires
  useEffect(() => {
    if (!state.rateLimit.isLimited || !state.rateLimit.resetTime) return;

    const now = new Date();
    const msUntilReset = state.rateLimit.resetTime.getTime() - now.getTime();

    if (msUntilReset <= 0) {
      // Already expired, clear immediately
      setState(prev => ({
        ...prev,
        rateLimit: {
          isLimited: false,
          retryAfterSeconds: 0,
          retryAfterMinutes: 0,
          resetTime: null,
        },
      }));
      return;
    }

    // Set timer to clear rate limit when it expires
    const timer = setTimeout(() => {
      setState(prev => ({
        ...prev,
        rateLimit: {
          isLimited: false,
          retryAfterSeconds: 0,
          retryAfterMinutes: 0,
          resetTime: null,
        },
      }));
    }, msUntilReset);

    return () => clearTimeout(timer);
  }, [state.rateLimit.isLimited, state.rateLimit.resetTime]);

  /**
   * Reset hook state to initial values
   */
  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: null,
      error: null,
      lastUploadUrl: null,
      rateLimit: {
        isLimited: false,
        retryAfterSeconds: 0,
        retryAfterMinutes: 0,
        resetTime: null,
      },
    });
  }, []);

  /**
   * Validate image before upload
   * @param imageUri - Image URI to validate
   * @returns Validation result
   */
  const validateImageFile = useCallback(async (imageUri: string) => {
    const validation = await validateImage(imageUri);
    if (!validation.valid) {
      setState(prev => ({ ...prev, error: validation.error || 'Invalid image' }));
      return false;
    }
    return true;
  }, []);

  /**
   * Upload profile picture
   * Handles the complete upload flow with progress tracking
   *
   * @param imageUri - Image URI from image picker (file:// or blob:)
   * @returns Public URL of uploaded image
   * @throws Error if upload fails
   */
  const upload = useCallback(async (
    imageUri: string
  ): Promise<string> => {
    if (!accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Check if rate limited
    if (state.rateLimit.isLimited) {
      throw new RateLimitError(
        state.rateLimit.retryAfterSeconds,
        `Rate limit in effect. Try again in ${state.rateLimit.retryAfterMinutes} minute${state.rateLimit.retryAfterMinutes !== 1 ? 's' : ''}.`
      );
    }

    // Reset state
    setState(prev => ({
      ...prev,
      uploading: true,
      progress: { step: 'starting', progress: 0 },
      error: null,
    }));

    try {
      // Validate image first
      const isValid = await validateImageFile(imageUri);
      if (!isValid) {
        throw new Error('Image validation failed');
      }

      // Update progress
      setState(prev => ({
        ...prev,
        progress: { step: 'uploading', progress: 20 }
      }));

      // Perform upload with progress callback
      const publicUrl = await uploadProfilePicture(
        imageUri,
        accessToken,
        (step, progress) => {
          setState(prev => ({
            ...prev,
            progress: { step, progress }
          }));
        }
      );

      // Success
      setState(prev => ({
        ...prev,
        uploading: false,
        progress: { step: 'complete', progress: 100 },
        error: null,
        lastUploadUrl: publicUrl,
      }));

      return publicUrl;

    } catch (error) {
      // Handle rate limit errors specially
      if (error instanceof RateLimitError) {
        const resetTime = new Date(Date.now() + error.retryAfter * 1000);
        
        setState(prev => ({
          ...prev,
          uploading: false,
          progress: null,
          error: error.message,
          lastUploadUrl: null,
          rateLimit: {
            isLimited: true,
            retryAfterSeconds: error.retryAfter,
            retryAfterMinutes: error.retryAfterMinutes,
            resetTime,
          },
        }));

        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      setState(prev => ({
        ...prev,
        uploading: false,
        progress: null,
        error: errorMessage,
        lastUploadUrl: null,
      }));

      throw error;
    }
  }, [accessToken, state.rateLimit, validateImageFile]);

  /**
   * Retry last upload (if it failed)
   * Assumes the image URI is still available
   */
  const retry = useCallback(async (imageUri: string) => {
    if (state.uploading) {
      throw new Error('Upload already in progress');
    }
    if (state.rateLimit.isLimited) {
      throw new RateLimitError(
        state.rateLimit.retryAfterSeconds,
        `Rate limit in effect. Try again in ${state.rateLimit.retryAfterMinutes} minute${state.rateLimit.retryAfterMinutes !== 1 ? 's' : ''}.`
      );
    }
    return upload(imageUri);
  }, [state.uploading, state.rateLimit, upload]);

  return {
    // State
    uploading: state.uploading,
    progress: state.progress,
    error: state.error,
    lastUploadUrl: state.lastUploadUrl,
    rateLimit: state.rateLimit,

    // Actions
    upload,
    retry,
    reset,
    validateImage: validateImageFile,
  };
}


