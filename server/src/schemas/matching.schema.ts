/**
 * @file src/schemas/matching.schema.ts
 * @description Zod validation schemas for matching engine endpoints
 * 
 * These schemas validate all user input before it reaches our services,
 * preventing API crashes, SQL injection, and providing clear error messages.
 */

import { z } from 'zod';

// ============================================
// LIKES SCHEMAS
// ============================================

/**
 * Schema for creating a like or pass
 * Used in: POST /api/likes
 */
export const createLikeSchema = z.object({
    likedId: z.string().uuid('Invalid user ID format'),
    liked: z.boolean({
        message: 'liked must be a boolean',
    }),
    message: z.string()
        .min(10, 'Message must be at least 10 characters')
        .max(500, 'Message cannot exceed 500 characters')
        .optional(),
}).refine((data) => {
    // If liked is true, message is required
    if (data.liked && !data.message) {
        return false;
    }
    return true;
}, {
    message: 'Message is required when liking someone',
    path: ['message'],
});

/**
 * Schema for accepting a like with optional reply message
 * Used in: POST /api/likes/:likeId/accept
 */
export const acceptLikeSchema = z.object({
    replyMessage: z.string()
        .min(1, 'Reply message cannot be empty')
        .max(500, 'Reply message cannot exceed 500 characters')
        .optional(),
});

/**
 * Schema for like ID parameter
 * Used in: POST /api/likes/:likeId/accept, DELETE /api/likes/:likeId
 * Accepts both UUID and CUID formats for backwards compatibility
 */
export const likeIdParamSchema = z.object({
    likeId: z.string().min(1, 'Like ID is required'),
});

// ============================================
// MATCHES SCHEMAS
// ============================================

/**
 * Schema for match ID parameter
 * Used in: POST /api/matches/:matchId/unmatch
 * Accepts both UUID and CUID formats for backwards compatibility
 */
export const matchIdParamSchema = z.object({
    matchId: z.string().min(1, 'Match ID is required'),
});

// ============================================
// FEED SCHEMAS
// ============================================

/**
 * Schema for feed query parameters with pagination
 * Used in: GET /api/feed
 */
export const feedQuerySchema = z.object({
    limit: z.string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 20)
        .refine(val => val >= 1 && val <= 50, 'Limit must be between 1 and 50'),
    cursor: z.string().uuid('Invalid cursor format').optional(),
});

// ============================================
// BLOCK SCHEMAS
// ============================================

/**
 * Schema for blocking a user
 * Used in: POST /api/users/block
 */
export const blockUserSchema = z.object({
    userId: z.string().uuid('Invalid user ID format'),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateLikeInput = z.infer<typeof createLikeSchema>;
export type AcceptLikeInput = z.infer<typeof acceptLikeSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
