/**
 * @file src/services/message.service.ts
 * @description Manages chat messages: send, edit, retrieve.
 * All operations verify match membership and enforce security rules.
 */

import { prisma } from '../lib/prisma.js';
import { sanitizeText } from '../utils/sanitizeText.js';
import { signProfilePicture } from '../utils/profilePicture.js';

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
   * Get messages for a match with sender profile info. User must be a participant.
   */
  async getMessages(matchId: string, userId: string) {
    await this.ensureMatchParticipant(matchId, userId);

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          }
        }
      }
    });

    // Transform to include only necessary sender info and sign profile pictures
    return Promise.all(messages.map(async (msg) => {
      console.log('Processing message:', msg.id, 'senderId:', msg.senderId, 'sender:', msg.sender); // Debug log
      let signedProfilePicture = null;
      try {
        signedProfilePicture = await signProfilePicture(msg.sender.profilePicture);
      } catch (error) {
        console.error('Failed to sign profile picture:', error);
        // Fallback to original URL if signing fails
        signedProfilePicture = msg.sender.profilePicture;
      }
      
      return {
        id: msg.id,
        matchId: msg.matchId,
        senderId: msg.senderId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          profilePicture: signedProfilePicture,
        },
        content: msg.content,
        createdAt: msg.createdAt,
        readAt: msg.readAt,
        editedAt: msg.editedAt,
      };
    }));
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
