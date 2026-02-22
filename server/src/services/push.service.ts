/**
 * @file src/services/push.service.ts
 * @description Sends push notifications via Expo Push API.
 * Used when a message is sent so the receiver gets a notification (Notification Message: title + body).
 */

import { prisma } from '../lib/prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface SendMessagePushParams {
  matchId: string;
  senderId: string;
  content: string;
}

export interface SendMatchPushParams {
  matchId: string;
  receiverId: string;
  otherUserId: string;
}

export interface SendRequestPushParams {
  receiverId: string;
  senderId: string;
  message?: string | null;
}

/**
 * Send a push notification to the receiver of a message.
 * Respects MatchNotificationPreference (no push if receiver muted).
 * Payload is a Notification Message: title (sender name), body (message content), data (matchId for tap).
 * Fire-and-forget: errors are logged and not thrown so the message send request is not failed.
 */
export async function sendMessagePush(params: SendMessagePushParams): Promise<void> {
  const { matchId, senderId, content } = params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true, blockedBy: true },
    });

    if (!match || match.status !== 'active') return;
    if (match.blockedBy) return;

    const receiverId = match.user1Id === senderId ? match.user2Id : match.user1Id;
    if (!receiverId || receiverId === senderId) return;

    const [pref, receiver, sender] = await Promise.all([
      prisma.matchNotificationPreference.findUnique({
        where: { matchId_userId: { matchId, userId: receiverId } },
        select: { enabled: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { pushToken: true },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      }),
    ]);

    if (pref?.enabled === false) return;
    if (!receiver?.pushToken) return;

    const title = sender?.name ?? 'New message';
    const body = (content && content.trim()) ? content.trim().slice(0, 200) : 'New message';

    const payload = {
      to: receiver.pushToken,
      sound: 'default' as const,
      title,
      body,
      data: {
        type: 'message',
        matchId,
        senderId,
      },
      priority: 'high' as const,
      channelId: 'default',
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.data?.status === 'error') {
      console.error('[push] Expo push error:', result.data.message);
    }
  } catch (err) {
    console.error('[push] sendMessagePush failed:', err);
  }
}

export async function sendMatchPush(params: SendMatchPushParams): Promise<void> {
  const { matchId, receiverId, otherUserId } = params;
  try {
    const [pref, receiver, otherUser] = await Promise.all([
      prisma.matchNotificationPreference.findUnique({
        where: { matchId_userId: { matchId, userId: receiverId } },
        select: { enabled: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { pushToken: true },
      }),
      prisma.user.findUnique({
        where: { id: otherUserId },
        select: { name: true },
      }),
    ]);

    if (pref?.enabled === false) return;
    if (!receiver?.pushToken) return;

    const title = 'It’s a match!';
    const body = otherUser?.name ? `${otherUser.name} is ready to chat.` : 'You have a new match.';

    const payload = {
      to: receiver.pushToken,
      sound: 'default' as const,
      title,
      body,
      data: {
        type: 'match',
        matchId,
        senderId: otherUserId,
      },
      priority: 'high' as const,
      channelId: 'default',
    };

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[push] sendMatchPush failed:', err);
  }
}

export async function sendRequestPush(params: SendRequestPushParams): Promise<void> {
  const { receiverId, senderId, message } = params;

  try {
    const [receiver, sender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { pushToken: true },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      }),
    ]);

    if (!receiver?.pushToken) return;

    const title = 'New request';
    const body = sender?.name ? `${sender.name} wants to connect.` : 'You have a new request.';
    const preview = message && message.trim() ? message.trim().slice(0, 120) : undefined;

    const payload = {
      to: receiver.pushToken,
      sound: 'default' as const,
      title,
      body,
      data: {
        type: 'request',
        senderId,
        preview,
      },
      priority: 'high' as const,
      channelId: 'default',
    };

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[push] sendRequestPush failed:', err);
  }
}
