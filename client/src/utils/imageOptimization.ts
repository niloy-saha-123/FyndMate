/**
 * @file client/src/utils/imageOptimization.ts
 * @description Image optimization utilities using Supabase Image Transformations
 * 
 * This utility automatically adds optimization parameters to Supabase image URLs
 * to reduce bandwidth and improve app performance.
 */

/**
 * Optimize image URLs using Supabase Image Transformations
 * Add this to any profile picture URL before displaying
 * 
 * @param url - The original Supabase storage URL
 * @param width - Target width in pixels (default: 500)
 * @param quality - JPEG quality 1-100 (default: 85)
 * @returns Optimized URL with transformation parameters
 * 
 * @example
 * // Large profile view
 * getOptimizedImageUrl(url, 800, 90)
 * 
 * // Normal card
 * getOptimizedImageUrl(url, 500, 85)
 * 
 * // Small thumbnail
 * getOptimizedImageUrl(url, 200, 80)
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  width = 500,
  quality = 85
): string => {
  if (!url) return ''; // Return empty string if no URL
  
  // Check if URL already has query parameters
  const separator = url.includes('?') ? '&' : '?';
  
  return `${url}${separator}width=${width}&quality=${quality}`;
};

/**
 * Preset image sizes for common use cases
 */
export const ImageSizes = {
  /** Large profile view - 800px, 90% quality */
  PROFILE_LARGE: { width: 800, quality: 90 },
  
  /** Standard card size - 500px, 85% quality */
  CARD: { width: 500, quality: 85 },
  
  /** Small thumbnail - 200px, 80% quality */
  THUMBNAIL: { width: 200, quality: 80 },
  
  /** Tab bar avatar - 100px, 80% quality */
  AVATAR_SMALL: { width: 100, quality: 80 },
  
  /** Message avatar - 150px, 85% quality */
  AVATAR_MESSAGE: { width: 150, quality: 85 },
} as const;

/**
 * Get optimized image URL with preset size
 * 
 * @param url - The original Supabase storage URL
 * @param preset - One of the ImageSizes presets
 * @returns Optimized URL
 * 
 * @example
 * getOptimizedImageWithPreset(url, ImageSizes.THUMBNAIL)
 */
export const getOptimizedImageWithPreset = (
  url: string | null | undefined,
  preset: { width: number; quality: number }
): string => {
  return getOptimizedImageUrl(url, preset.width, preset.quality);
};
