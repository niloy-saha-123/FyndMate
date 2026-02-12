/**
 * @file src/schemas/validation-constants.ts
 * @description Shared validation constants for message lengths.
 * 
 * These constants define the character limits for different message types
 * across the application. They are used by both schemas and services.
 * 
 * IMPORTANT: Keep these in sync with client-side constants in:
 * - client/src/constants/validation.ts
 */

// ============================================
// MESSAGE LIMITS (Normal messages in messages)
// ============================================
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 2000;

// ============================================
// INTRO MESSAGE LIMITS (Like requests in discovery feed)
// ============================================
export const INTRO_MESSAGE_MIN_LENGTH = 10;
export const INTRO_MESSAGE_MAX_LENGTH = 500;

// ============================================
// REPLY MESSAGE LIMITS (Accepting a like with reply)
// ============================================
export const REPLY_MESSAGE_MIN_LENGTH = 1;
export const REPLY_MESSAGE_MAX_LENGTH = 500;

// ============================================
// PROFILE LIMITS
// ============================================
export const PROFILE_BIO_MAX_LENGTH = 300;
export const PROFILE_MAX_SKILLS = 15;
export const PROFILE_MAX_INTERESTS = 15;
export const PROFILE_TAG_MAX_LENGTH = 30;
export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_GITHUB_MAX_LENGTH = 100;
export const PROFILE_MIN_AGE = 13;
export const PROFILE_PICTURE_MAX_SIZE_MB = 5;

// ============================================
// RATE LIMITS
// ============================================
export const LIKES_RATE_LIMIT = 30;
export const LIKES_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours
