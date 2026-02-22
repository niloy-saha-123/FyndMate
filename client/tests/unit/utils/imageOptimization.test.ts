import { describe, it, expect } from 'vitest';
import {
  getOptimizedImageUrl,
  getOptimizedImageWithPreset,
  ImageSizes,
} from '../../../src/utils/imageOptimization';

describe('imageOptimization utils', () => {
  it('returns empty string for missing URL', () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
  });

  it('appends optimization query params when URL has no query string', () => {
    const url = getOptimizedImageUrl('https://cdn.example.com/avatar.jpg', 500, 85);
    expect(url).toBe('https://cdn.example.com/avatar.jpg?width=500&quality=85');
  });

  it('appends params using ampersand when URL already has query', () => {
    const url = getOptimizedImageUrl('https://cdn.example.com/avatar.jpg?token=abc', 200, 80);
    expect(url).toBe('https://cdn.example.com/avatar.jpg?token=abc&width=200&quality=80');
  });

  it('uses preset values through helper', () => {
    const url = getOptimizedImageWithPreset('https://cdn.example.com/avatar.jpg', ImageSizes.THUMBNAIL);
    expect(url).toBe('https://cdn.example.com/avatar.jpg?width=200&quality=80');
  });

  it('all presets produce valid query params (performance/UX)', () => {
    const base = 'https://cdn.example.com/img.jpg';
    expect(getOptimizedImageWithPreset(base, ImageSizes.PROFILE_LARGE)).toContain('width=800');
    expect(getOptimizedImageWithPreset(base, ImageSizes.CARD)).toContain('width=500');
    expect(getOptimizedImageWithPreset(base, ImageSizes.AVATAR_SMALL)).toContain('width=100');
    expect(getOptimizedImageWithPreset(base, ImageSizes.AVATAR_MESSAGE)).toContain('width=150');
  });
});
