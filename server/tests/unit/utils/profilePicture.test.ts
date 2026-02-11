/**
 * @file tests/unit/utils/profilePicture.test.ts
 * @description Unit tests for profile picture utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signProfilePicture } from '../../../src/utils/profilePicture.js';

// Mock Supabase admin
vi.mock('../../../src/lib/supabaseAdmin.js', () => ({
    supabaseAdmin: {
        storage: {
            from: vi.fn(() => ({
                createSignedUrl: vi.fn(),
            })),
        },
    },
}));

describe('signProfilePicture', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Should return null when input is null
     */
    it('returns null for null input', async () => {
        const result = await signProfilePicture(null);
        expect(result).toBeNull();
    });

    /**
     * Should return null when input is empty string
     */
    it('returns null for empty string', async () => {
        const result = await signProfilePicture('');
        expect(result).toBeNull();
    });

    /**
     * Should return null when input is undefined
     */
    it('returns null for undefined', async () => {
        const result = await signProfilePicture(undefined);
        expect(result).toBeNull();
    });

    /**
     * Should call createSignedUrl with correct path and return signed URL
     */
    it('calls createSignedUrl with correct path and returns signed URL', async () => {
        const { supabaseAdmin } = await import('../../../src/lib/supabaseAdmin.js');

        const mockCreateSignedUrl = vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://signed-url.com/path/to/image.jpg?token=abc123' },
            error: null,
        });

        (supabaseAdmin.storage.from as any).mockReturnValue({
            createSignedUrl: mockCreateSignedUrl,
        });

        const result = await signProfilePicture('profile-pictures/user123.jpg');

        expect(mockCreateSignedUrl).toHaveBeenCalledWith('profile-pictures/user123.jpg', 1800);
        expect(result).toBe('https://signed-url.com/path/to/image.jpg?token=abc123');
    });

    /**
     * Should return null when Supabase returns error
     */
    it('returns null when supabase returns error', async () => {
        const { supabaseAdmin } = await import('../../../src/lib/supabaseAdmin.js');

        const mockCreateSignedUrl = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error' },
        });

        (supabaseAdmin.storage.from as any).mockReturnValue({
            createSignedUrl: mockCreateSignedUrl,
        });

        const result = await signProfilePicture('profile-pictures/error.jpg');
        expect(result).toBeNull();
    });
});
