/**
 * @file src/schemas/chat.schema.ts
 * @description Zod validation for chat/message endpoints
 */

import { z } from 'zod';
import {
    CHAT_MESSAGE_MIN_LENGTH,
    CHAT_MESSAGE_MAX_LENGTH,
} from './validation-constants.js';

export const sendMessageSchema = z.object({
    content: z.string()
        .min(CHAT_MESSAGE_MIN_LENGTH, `Message must be at least ${CHAT_MESSAGE_MIN_LENGTH} character`)
        .max(CHAT_MESSAGE_MAX_LENGTH, `Message cannot exceed ${CHAT_MESSAGE_MAX_LENGTH} characters`),
});

export const editMessageSchema = z.object({
    content: z.string()
        .min(CHAT_MESSAGE_MIN_LENGTH, `Message must be at least ${CHAT_MESSAGE_MIN_LENGTH} character`)
        .max(CHAT_MESSAGE_MAX_LENGTH, `Message cannot exceed ${CHAT_MESSAGE_MAX_LENGTH} characters`),
});

export const messageIdParamSchema = z.object({
    messageId: z.string().uuid('Invalid message ID format'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
