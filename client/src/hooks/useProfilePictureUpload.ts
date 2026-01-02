/**
 * @file client/src/hooks/useProfilePictureUpload.ts
 * @description React hook for profile picture uploads
 *
 * Provides upload state management, progress tracking, and error handling.
 * Integrates with uploadService.ts for the actual upload logic.
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

import { useState, useCallback } from 'react';
import { uploadProfilePicture, validateImage } from '../services/uploadService';

export interface UploadProgress {
  step: string;
  progress: number;
}

export interface UploadHookState {
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  lastUploadUrl: string | null;
}

/**
 * Hook for managing profile picture upload state and operations
 *
 * @param authToken - JWT token for authentication (can be from context/store)
 * @returns Upload functions and state
 */
export function useProfilePictureUpload(authToken?: string) {
  const [state, setState] = useState<UploadHookState>({
    uploading: false,
    progress: null,
    error: null,
    lastUploadUrl: null,
  });

  /**
   * Reset hook state to initial values
   */
  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: null,
      error: null,
      lastUploadUrl: null,
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
   * @param token - Optional auth token override
   * @returns Public URL of uploaded image
   * @throws Error if upload fails
   */
  const upload = useCallback(async (
    imageUri: string,
    token?: string
  ): Promise<string> => {
    const jwtToken = token || authToken;
    if (!jwtToken) {
      throw new Error('Authentication token required');
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
        jwtToken,
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
  }, [authToken, validateImageFile]);

  /**
   * Retry last upload (if it failed)
   * Assumes the image URI is still available
   */
  const retry = useCallback(async (imageUri: string) => {
    if (state.uploading) {
      throw new Error('Upload already in progress');
    }
    return upload(imageUri);
  }, [state.uploading, upload]);

  return {
    // State
    uploading: state.uploading,
    progress: state.progress,
    error: state.error,
    lastUploadUrl: state.lastUploadUrl,

    // Actions
    upload,
    retry,
    reset,
    validateImage: validateImageFile,
  };
}


