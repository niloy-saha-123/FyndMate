/**
 * @file tests/unit/schemas/upload-schema.test.ts
 * @description Unit tests for upload route schemas
 */

import { describe, it, expect } from 'vitest';
import {
    requestUploadSchema,
    confirmUploadSchema,
} from '../../../src/schemas/upload.schema.js';

describe('requestUploadSchema', () => {
    /**
     * Should accept jpg extension
     */
    it('accepts jpg extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept jpeg extension
     */
    it('accepts jpeg extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpeg',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept png extension
     */
    it('accepts png extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'png',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept webp extension
     */
    it('accepts webp extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'webp',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject gif extension
     */
    it('rejects gif extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'gif',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject exe extension
     */
    it('rejects exe extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'exe',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject heic extension
     */
    it('rejects heic extension', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'heic',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept fileSizeBytes within limit
     */
    it('accepts fileSizeBytes within limit', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
            fileSizeBytes: 1024 * 1024 * 3, // 3MB
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject fileSizeBytes > 5MB
     */
    it('rejects fileSizeBytes > 5MB', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
            fileSizeBytes: 1024 * 1024 * 6, // 6MB
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject negative fileSizeBytes
     */
    it('rejects negative fileSizeBytes', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
            fileSizeBytes: -100,
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject non-integer fileSizeBytes
     */
    it('rejects non-integer fileSizeBytes', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
            fileSizeBytes: 1024.5,
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept missing fileSizeBytes
     */
    it('accepts missing fileSizeBytes', () => {
        const result = requestUploadSchema.safeParse({
            fileExtension: 'jpg',
        });
        expect(result.success).toBe(true);
    });
});

describe('confirmUploadSchema', () => {
    /**
     * Should reject empty uploadPath
     */
    it('rejects empty uploadPath', () => {
        const result = confirmUploadSchema.safeParse({
            uploadPath: '',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept valid uploadPath with idempotencyKey
     */
    it('accepts valid with idempotencyKey', () => {
        const result = confirmUploadSchema.safeParse({
            uploadPath: 'profile-pictures/user123.jpg',
            idempotencyKey: 'unique-key-123',
        });
        expect(result.success).toBe(true);
    });
});
