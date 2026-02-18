/**
 * @file client/src/constants/validation.ts
 * @description Shared validation constants for message lengths.
 * 
 * These constants define the character limits for different message types
 * across the application. They must match the server-side constants in:
 * - server/src/schemas/validation-constants.ts
 * 
 * IMPORTANT: Keep these in sync with server-side validation!
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
export const PROFILE_TAG_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} +#./&-]*$/u;
export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_GITHUB_MAX_LENGTH = 39;
export const PROFILE_MIN_AGE = 13;
export const PROFILE_PICTURE_MAX_SIZE_MB = 5;
export const PROFILE_MAX_PROJECTS = 5;
export const PROFILE_MAX_EXPERIENCES = 5;
export const PROFILE_PROJECT_NAME_MAX_LENGTH = 100;
export const PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH = 500;
export const PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH = 100;
export const PROFILE_EXPERIENCE_POSITION_MAX_LENGTH = 100;
export const PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH = 500;

// ============================================
// REPORT LIMITS
// ============================================
export const REPORT_REASON_MIN_LENGTH = 10;
export const REPORT_REASON_MAX_LENGTH = 500;

// ============================================
// RATE LIMITS
// ============================================
export const LIKES_RATE_LIMIT = 30;
export const LIKES_RATE_LIMIT_WINDOW_HOURS = 24;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a message is valid
 */
export function isMessageValid(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length >= MESSAGE_MIN_LENGTH && trimmed.length <= MESSAGE_MAX_LENGTH;
}

/**
 * Check if an intro message is valid
 */
export function isIntroMessageValid(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length >= INTRO_MESSAGE_MIN_LENGTH && trimmed.length <= INTRO_MESSAGE_MAX_LENGTH;
}

/**
 * Get validation error message for messages
 */
export function getMessageError(message: string): string | null {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return 'Message cannot be empty';
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
        return `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`;
    }
    return null;
}

/**
 * Get validation error message for intro messages
 */
export function getIntroMessageError(message: string): string | null {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return `Message must be at least ${INTRO_MESSAGE_MIN_LENGTH} characters`;
    }
    if (trimmed.length < INTRO_MESSAGE_MIN_LENGTH) {
        return `Message must be at least ${INTRO_MESSAGE_MIN_LENGTH} characters (${trimmed.length}/${INTRO_MESSAGE_MIN_LENGTH})`;
    }
    if (trimmed.length > INTRO_MESSAGE_MAX_LENGTH) {
        return `Message cannot exceed ${INTRO_MESSAGE_MAX_LENGTH} characters`;
    }
    return null;
}
