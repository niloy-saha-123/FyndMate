/**
 * @file src/services/message.service.ts
 * @description Manages messages: send, edit, retrieve.
 * All operations verify match membership and enforce security rules.
 */

import { prisma } from '../lib/prisma.js';
import { sanitizeText } from '../utils/sanitizeText.js';

const MAX_MESSAGE_LENGTH = 2000;
const EDIT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes (matches RLS policy)

export class MessageService {
  /**
   * Verifies the user is a participant in the match.
   */
  private async ensureMatchParticipant(matchId: string, userId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, user1Id: true, user2Id: true, status: true },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const isParticipant = match.user1Id === userId || match.user2Id === userId;
    if (!isParticipant) {
      throw new Error('Not authorized');
    }

    return match;
  }

  /**
   * Get messages for a match. User must be a participant.
   * Includes sender profile data for UI display.
   */
  async getMessages(matchId: string, userId: string) {
    await this.ensureMatchParticipant(matchId, userId);

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' }, // Oldest first - UI will reverse for display
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
        editedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          }
        }
      },
    });

    return messages;
  }

  /**
   * Send a message. Match must be active and not blocked.
   */
  async sendMessage(matchId: string, senderId: string, content: string) {
    const match = await this.ensureMatchParticipant(matchId, senderId);

    if (match.status !== 'active') {
      throw new Error('Cannot send message - match is not active');
    }

    const sanitized = sanitizeText(content);
    if (!sanitized || sanitized.length < 1) {
      throw new Error('Message cannot be empty');
    }
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    return prisma.message.create({
      data: {
        matchId,
        senderId,
        content: sanitized,
      },
    });
  }

  /**
   * Edit a message. Only sender, within edit window.
   */
  async editMessage(messageId: string, senderId: string, content: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { match: true },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== senderId) {
      throw new Error('Not authorized');
    }

    const isParticipant =
      message.match.user1Id === senderId || message.match.user2Id === senderId;
    if (!isParticipant) {
      throw new Error('Not authorized');
    }

    if (message.match.status !== 'active') {
      throw new Error('Cannot edit message - match is not active');
    }

    const elapsed = Date.now() - new Date(message.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      throw new Error('Message can only be edited within 3 minutes');
    }

    const sanitized = sanitizeText(content);
    if (!sanitized || sanitized.length < 1) {
      throw new Error('Message cannot be empty');
    }
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        content: sanitized,
        editedAt: new Date(),
      },
    });
  }
}

export const messageService = new MessageService();
