import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/apiClient', () => {
  return {
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

import { apiClient } from '../../../src/lib/apiClient';
import {
  getDiscoveryFeed,
  sendLike,
  LikesRateLimitError,
} from '../../../src/services/matchingService';

describe('matchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds feed query with limit and cursor', async () => {
    (apiClient.get as any).mockResolvedValue({ data: [{ id: 'u1' }] });

    const data = await getDiscoveryFeed(10, 'cursor123');

    expect(apiClient.get).toHaveBeenCalledWith('/api/feed?limit=10&cursor=cursor123');
    expect(data).toEqual([{ id: 'u1' }]);
  });

  it('wraps rate-limit responses in LikesRateLimitError', async () => {
    (apiClient.post as any).mockRejectedValue(new Error('Too many requests'));

    await expect(sendLike('user-2', true, 'hello')).rejects.toBeInstanceOf(LikesRateLimitError);
  });

  it('passes through non-rate-limit errors', async () => {
    const err = new Error('validation failed');
    (apiClient.post as any).mockRejectedValue(err);

    await expect(sendLike('user-2', true, 'hello')).rejects.toThrow('validation failed');
  });
});
