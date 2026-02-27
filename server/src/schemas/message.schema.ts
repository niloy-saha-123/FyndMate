/**
 * @file src/schemas/message.schema.ts
 * @description Zod validation for message endpoints
 */

import { z } from 'zod';
import {
    MESSAGE_MIN_LENGTH,
    MESSAGE_MAX_LENGTH,
} from './validation-constants.js';

export const sendMessageSchema = z.object({
    content: z.string()
        .min(MESSAGE_MIN_LENGTH, `Message must be at least ${MESSAGE_MIN_LENGTH} character`)
        .max(MESSAGE_MAX_LENGTH, `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`),
});

export const editMessageSchema = z.object({
    content: z.string()
        .min(MESSAGE_MIN_LENGTH, `Message must be at least ${MESSAGE_MIN_LENGTH} character`)
        .max(MESSAGE_MAX_LENGTH, `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`),
});

export const messageIdParamSchema = z.object({
    messageId: z.string().uuid('Invalid message ID format'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
