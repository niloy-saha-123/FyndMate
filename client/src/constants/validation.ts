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
// CHAT MESSAGE LIMITS (Normal messages in chat)
// ============================================
export const CHAT_MESSAGE_MIN_LENGTH = 1;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

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
export const LIKES_RATE_LIMIT_WINDOW_HOURS = 24;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a chat message is valid
 */
export function isChatMessageValid(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length >= CHAT_MESSAGE_MIN_LENGTH && trimmed.length <= CHAT_MESSAGE_MAX_LENGTH;
}

/**
 * Check if an intro message is valid
 */
export function isIntroMessageValid(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length >= INTRO_MESSAGE_MIN_LENGTH && trimmed.length <= INTRO_MESSAGE_MAX_LENGTH;
}

/**
 * Get validation error message for chat messages
 */
export function getChatMessageError(message: string): string | null {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return 'Message cannot be empty';
    }
    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
        return `Message cannot exceed ${CHAT_MESSAGE_MAX_LENGTH} characters`;
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
