import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimitError } from '../../../src/services/uploadService';

// Helpers --------------------------------------------------------------------
function renderHook<T>(hook: () => T) {
  let value: T;
  function Test() {
    value = hook();
    return null;
  }
  const inst = renderer.create(<Test />);
  return {
    result: () => value!,
    rerender: () => inst.update(<Test />),
    unmount: () => inst.unmount(),
  };
}

// Mocks ----------------------------------------------------------------------
vi.mock('../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ accessToken: 'token-123' }),
}));

const uploadProfilePictureMock = vi.fn();
const validateImageMock = vi.fn();

vi.mock('../../../src/services/uploadService', () => ({
  uploadProfilePicture: (...args: any[]) => uploadProfilePictureMock(...args),
  validateImage: (...args: any[]) => validateImageMock(...args),
  RateLimitError: class extends Error {
    retryAfter: number;
    retryAfterMinutes: number;
    constructor(retryAfter: number, message?: string) {
      super(message);
      this.retryAfter = retryAfter;
      this.retryAfterMinutes = Math.ceil(retryAfter / 60);
    }
  },
}));

describe('useProfilePictureUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uploadProfilePictureMock.mockReset();
    validateImageMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uploads successfully and records last URL', async () => {
    validateImageMock.mockResolvedValue({ valid: true });
    uploadProfilePictureMock.mockResolvedValue('https://cdn.test/pic.jpg');

    const { useProfilePictureUpload } = await import('../../../src/hooks/useProfilePictureUpload');
    const { result } = renderHook(() => useProfilePictureUpload());

    await act(async () => {
      const url = await result().upload('file://image.jpg');
      expect(url).toBe('https://cdn.test/pic.jpg');
    });

    expect(result().lastUploadUrl).toBe('https://cdn.test/pic.jpg');
    expect(result().error).toBeNull();
    expect(result().uploading).toBe(false);
    expect(result().progress?.step).toBe('complete');
  });

  it('surfaces rate limit and sets reset timer', async () => {
    validateImageMock.mockResolvedValue({ valid: true });
    uploadProfilePictureMock.mockRejectedValue(new RateLimitError(120, 'limited'));

    const { useProfilePictureUpload } = await import('../../../src/hooks/useProfilePictureUpload');
    const { result } = renderHook(() => useProfilePictureUpload());

    await act(async () => {
      await expect(result().upload('file://image.jpg')).rejects.toThrow('limited');
    });

    expect(result().rateLimit.isLimited).toBe(true);
    expect(result().rateLimit.retryAfterSeconds).toBe(120);

    // advance timer to clear limit automatically
    act(() => {
      vi.advanceTimersByTime(120 * 1000);
    });
    expect(result().rateLimit.isLimited).toBe(false);
  });

  it('validateImage failure stops upload early', async () => {
    validateImageMock.mockResolvedValue({ valid: false, error: 'bad file' });

    const { useProfilePictureUpload } = await import('../../../src/hooks/useProfilePictureUpload');
    const { result } = renderHook(() => useProfilePictureUpload());

    await expect(
      act(async () => {
        await result().upload('file://image.jpg');
      })
    ).rejects.toThrow('Image validation failed');

    expect(uploadProfilePictureMock).not.toHaveBeenCalled();
    expect(result().error).toBe('bad file');
  });
});
