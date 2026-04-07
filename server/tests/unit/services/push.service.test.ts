/**
 * @file tests/unit/services/push.service.test.ts
 * @description Unit tests for push.service (mocked prisma and fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const matchFindUnique = vi.fn();
const prefFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    match: { findUnique: (...args: unknown[]) => matchFindUnique(...args) },
    matchNotificationPreference: { findUnique: (...args: unknown[]) => prefFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
  },
}));

describe('sendMessagePush', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls: { url: string; body: string }[] = [];

  beforeEach(async () => {
    fetchCalls = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, body: (init?.body as string) ?? '' });
      return {
        ok: true,
        json: () => Promise.resolve({ data: { status: 'ok' } }),
      } as Response;
    });
    matchFindUnique.mockReset();
    prefFindUnique.mockReset();
    userFindUnique.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends Notification Message payload with title, body, data.matchId', async () => {
    matchFindUnique.mockResolvedValue({
      user1Id: 'user1',
      user2Id: 'user2',
      status: 'active',
      blockedBy: null,
    });
    prefFindUnique.mockResolvedValue({ enabled: true });
    userFindUnique.mockImplementation((args: { where: { id: string } }) => {
      if (args.where.id === 'user2') return Promise.resolve({ pushToken: 'ExponentPushToken[test]' });
      if (args.where.id === 'user1') return Promise.resolve({ name: 'Alice' });
      return Promise.resolve(null);
    });

    const { sendMessagePush } = await import('../../../src/services/push.service.js');
    await sendMessagePush({
      matchId: 'match-1',
      senderId: 'user1',
      content: 'Hi there',
    });

    expect(fetchCalls.length).toBe(1);
    const payload = JSON.parse(fetchCalls[0].body);
    expect(payload.title).toBe('Alice');
    expect(payload.body).toBe('Hi there');
    expect(payload.data).toEqual({ type: 'message', matchId: 'match-1', senderId: 'user1' });
    expect(payload.to).toBe('ExponentPushToken[test]');
    expect(payload.sound).toBe('default');
    expect(payload.channelId).toBe('default');
  });

  it('does not call fetch when receiver has no push token', async () => {
    matchFindUnique.mockResolvedValue({
      user1Id: 'user1',
      user2Id: 'user2',
      status: 'active',
      blockedBy: null,
    });
    prefFindUnique.mockResolvedValue({ enabled: true });
    userFindUnique.mockImplementation((args: { where: { id: string } }) => {
      if (args.where.id === 'user2') return Promise.resolve({ pushToken: null });
      if (args.where.id === 'user1') return Promise.resolve({ name: 'Alice' });
      return Promise.resolve(null);
    });

    const { sendMessagePush } = await import('../../../src/services/push.service.js');
    await sendMessagePush({ matchId: 'match-1', senderId: 'user1', content: 'Hi' });

    expect(fetchCalls.length).toBe(0);
  });

  it('does not call fetch when notification preference is disabled', async () => {
    matchFindUnique.mockResolvedValue({
      user1Id: 'user1',
      user2Id: 'user2',
      status: 'active',
      blockedBy: null,
    });
    prefFindUnique.mockResolvedValue({ enabled: false });
    userFindUnique.mockResolvedValue({ pushToken: 'ExponentPushToken[x]' });

    const { sendMessagePush } = await import('../../../src/services/push.service.js');
    await sendMessagePush({ matchId: 'match-1', senderId: 'user1', content: 'Hi' });

    expect(fetchCalls.length).toBe(0);
  });
});
