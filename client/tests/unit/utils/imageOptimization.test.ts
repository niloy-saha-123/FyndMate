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
});
