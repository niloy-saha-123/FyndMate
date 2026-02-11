/**
 * @file src/schemas/chat.schema.ts
 * @description Zod validation for chat/message endpoints
 */

import { z } from 'zod';

export const sendMessageSchema = z.object({
    content: z.string()
        .min(1, 'Message cannot be empty')
        .max(2000, 'Message cannot exceed 2000 characters'),
});

export const editMessageSchema = z.object({
    content: z.string()
        .min(1, 'Message cannot be empty')
        .max(2000, 'Message cannot exceed 2000 characters'),
});

export const messageIdParamSchema = z.object({
    messageId: z.string().uuid('Invalid message ID format'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
