import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../../src/lib/apiClient', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
  },
}));

import {
  getMyMatches,
  sendMessage,
  unmatchMatch,
  blockMatch,
  reportUser,
} from '../../../src/messages/message.service';

describe('message.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMyMatches computes lastMessage and unreadCount', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'm1',
          messages: [
            { id: 'msg3', senderId: 'other', readAt: null, content: 'latest' },
            { id: 'msg2', senderId: 'other', readAt: null, content: 'older unread' },
            { id: 'msg1', senderId: 'me', readAt: null, content: 'mine' },
          ],
        },
      ],
    });

    const matches = await getMyMatches('me');

    expect(mockGet).toHaveBeenCalledWith('/api/matches');
    expect(matches).toHaveLength(1);
    expect(matches[0].lastMessage.id).toBe('msg3');
    expect(matches[0].unreadCount).toBe(2);
  });

  it('sendMessage posts content payload', async () => {
    mockPost.mockResolvedValue({ id: 'msg-1' });

    const result = await sendMessage('match-1', 'Hello there');

    expect(mockPost).toHaveBeenCalledWith('/api/matches/match-1/messages', { content: 'Hello there' });
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('unmatchMatch and blockMatch call their endpoints', async () => {
    mockPost.mockResolvedValue({ success: true });

    await unmatchMatch('match-42');
    await blockMatch('match-42');

    expect(mockPost).toHaveBeenNthCalledWith(1, '/api/matches/match-42/unmatch');
    expect(mockPost).toHaveBeenNthCalledWith(2, '/api/matches/match-42/block');
  });

  it('reportUser posts userId + reason', async () => {
    mockPost.mockResolvedValue({ success: true });

    await reportUser('user-2', 'Spam and harassment in messages');

    expect(mockPost).toHaveBeenCalledWith('/api/users/report', {
      userId: 'user-2',
      reason: 'Spam and harassment in messages',
    });
  });
});
