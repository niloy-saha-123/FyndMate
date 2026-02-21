/**
 * @file src/services/message.service.ts
 * @description Manages messages: send, edit, retrieve.
 * All operations verify match membership and enforce security rules.
 */

import { prisma } from '../lib/prisma.js';
import { sanitizeText } from '../utils/sanitizeText.js';

const MAX_MESSAGE_LENGTH = 2000;
const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (matches RLS policy)

export class MessageService {
  /**
   * Verifies the user is a participant in the match.
   */
  private async ensureMatchParticipant(matchId: string, userId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        status: true,
        conversationStartAt: true,
      },
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
    const match = await this.ensureMatchParticipant(matchId, userId);

    const messages = await prisma.message.findMany({
      where: {
        matchId,
        createdAt: { gte: match.conversationStartAt },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first - UI will reverse for display
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
        editedAt: true,
        isDeleted: true,
        deletedBy: true,
        deletedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          }
        }
      },
    });

    return messages.map((message) => {
      if (!message.isDeleted) return message;

      const deletedLabel =
        message.senderId === userId
          ? 'You deleted a message'
          : `${message.sender.name} deleted a message`;

      return {
        ...message,
        content: deletedLabel,
      };
    });
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

    if (message.isDeleted) {
      throw new Error('Cannot edit deleted message');
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

    if (new Date(message.createdAt) < new Date(message.match.conversationStartAt)) {
      throw new Error('Cannot edit message from a previous conversation');
    }

    const elapsed = Date.now() - new Date(message.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      throw new Error('Message can only be edited within 5 minutes');
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

  /**
   * Soft delete a message. Only sender, within edit/delete window.
   */
  async deleteMessage(messageId: string, senderId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { match: true, sender: { select: { name: true } } },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.isDeleted) {
      throw new Error('Message already deleted');
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
      throw new Error('Cannot delete message - match is not active');
    }

    if (new Date(message.createdAt) < new Date(message.match.conversationStartAt)) {
      throw new Error('Cannot delete message from a previous conversation');
    }

    const elapsed = Date.now() - new Date(message.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      throw new Error('Message can only be deleted within 5 minutes');
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedBy: senderId,
        deletedAt: new Date(),
      },
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
        editedAt: true,
        isDeleted: true,
        deletedBy: true,
        deletedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          }
        }
      },
    });

    const deletedLabel =
      updated.senderId === senderId
        ? 'You deleted a message'
        : `${updated.sender.name} deleted a message`;

    return {
      ...updated,
      content: deletedLabel,
    };
  }
}

export const messageService = new MessageService();
