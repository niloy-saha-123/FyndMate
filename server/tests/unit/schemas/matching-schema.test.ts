/**
 * @file tests/unit/schemas/matching-schema.test.ts
 * @description Unit tests for matching route schemas
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
    createLikeSchema,
    acceptLikeSchema,
    likeIdParamSchema,
    matchIdParamSchema,
    feedQuerySchema,
    blockUserSchema,
    reportUserSchema,
} from '../../../src/schemas/matching.schema.js';

describe('createLikeSchema', () => {
    /**
     * Should accept valid like with UUID and message >= 10 chars
     */
    it('accepts valid like with UUID and message >= 10 chars', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
            message: 'Hello there!',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept valid pass without message
     */
    it('accepts valid pass without message', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: false,
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject non-UUID likedId
     */
    it('rejects non-UUID likedId', () => {
        const result = createLikeSchema.safeParse({
            likedId: 'not-a-uuid',
            liked: true,
            message: 'Hello there!',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject missing liked field
     */
    it('rejects missing liked field', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            message: 'Hello there!',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should require message when liked=true
     */
    it('requires message when liked=true', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject message < 10 chars
     */
    it('rejects message < 10 chars', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
            message: 'Hi!',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject message > 500 chars
     */
    it('rejects message > 500 chars', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
            message: 'a'.repeat(501),
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should accept exactly 10 char message
     */
    it('accepts exactly 10 char message', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
            message: '1234567890',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept exactly 500 char message
     */
    it('accepts exactly 500 char message', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: true,
            message: 'a'.repeat(500),
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should allow omitted message when liked=false
     */
    it('allows omitted message when liked=false', () => {
        const result = createLikeSchema.safeParse({
            likedId: crypto.randomUUID(),
            liked: false,
        });
        expect(result.success).toBe(true);
    });
});

describe('acceptLikeSchema', () => {
    /**
     * Should accept valid replyMessage
     */
    it('accepts valid with replyMessage', () => {
        const result = acceptLikeSchema.safeParse({
            replyMessage: 'Thanks for reaching out!',
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should accept without replyMessage
     */
    it('accepts valid without replyMessage', () => {
        const result = acceptLikeSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    /**
     * Should reject empty string
     */
    it('rejects empty string', () => {
        const result = acceptLikeSchema.safeParse({
            replyMessage: '',
        });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject > 500 chars
     */
    it('rejects > 500 chars', () => {
        const result = acceptLikeSchema.safeParse({
            replyMessage: 'a'.repeat(501),
        });
        expect(result.success).toBe(false);
    });
});

describe('likeIdParamSchema', () => {
    /**
     * Should accept valid string
     */
    it('accepts valid string', () => {
        const result = likeIdParamSchema.safeParse({
            likeId: crypto.randomUUID(),
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject empty string
     */
    it('rejects empty string', () => {
        const result = likeIdParamSchema.safeParse({
            likeId: '',
        });
        expect(result.success).toBe(false);
    });
});

describe('matchIdParamSchema', () => {
    /**
     * Should accept valid string
     */
    it('accepts valid string', () => {
        const result = matchIdParamSchema.safeParse({
            matchId: crypto.randomUUID(),
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject empty string
     */
    it('rejects empty string', () => {
        const result = matchIdParamSchema.safeParse({
            matchId: '',
        });
        expect(result.success).toBe(false);
    });
});

describe('feedQuerySchema', () => {
    /**
     * Should default limit to 20
     */
    it('defaults limit to 20', () => {
        const result = feedQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.limit).toBe(20);
        }
    });

    /**
     * Should parse "10" string to 10 number
     */
    it('parses "10" to number 10', () => {
        const result = feedQuerySchema.safeParse({ limit: '10' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.limit).toBe(10);
        }
    });

    /**
     * Should reject "0"
     */
    it('rejects "0"', () => {
        const result = feedQuerySchema.safeParse({ limit: '0' });
        expect(result.success).toBe(false);
    });

    /**
     * Should reject "51"
     */
    it('rejects "51"', () => {
        const result = feedQuerySchema.safeParse({ limit: '51' });
        expect(result.success).toBe(false);
    });

    /**
     * Should validate cursor as UUID
     */
    it('validates cursor as UUID', () => {
        const validResult = feedQuerySchema.safeParse({
            cursor: crypto.randomUUID(),
        });
        expect(validResult.success).toBe(true);

        const invalidResult = feedQuerySchema.safeParse({
            cursor: 'not-a-uuid',
        });
        expect(invalidResult.success).toBe(false);
    });

    /**
     * Should allow no cursor
     */
    it('allows no cursor', () => {
        const result = feedQuerySchema.safeParse({});
        expect(result.success).toBe(true);
    });
});

describe('blockUserSchema', () => {
    /**
     * Should accept valid UUID
     */
    it('accepts valid UUID', () => {
        const result = blockUserSchema.safeParse({
            userId: crypto.randomUUID(),
        });
        expect(result.success).toBe(true);
    });

    /**
     * Should reject non-UUID
     */
    it('rejects non-UUID', () => {
        const result = blockUserSchema.safeParse({
            userId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
    });
});

describe('reportUserSchema', () => {
    it('accepts valid payload', () => {
        const result = reportUserSchema.safeParse({
            userId: crypto.randomUUID(),
            reason: 'Spam and harassment in messages',
        });
        expect(result.success).toBe(true);
    });

    it('rejects short reason', () => {
        const result = reportUserSchema.safeParse({
            userId: crypto.randomUUID(),
            reason: 'Too bad',
        });
        expect(result.success).toBe(false);
    });

    it('rejects oversized reason', () => {
        const result = reportUserSchema.safeParse({
            userId: crypto.randomUUID(),
            reason: 'a'.repeat(501),
        });
        expect(result.success).toBe(false);
    });
});
