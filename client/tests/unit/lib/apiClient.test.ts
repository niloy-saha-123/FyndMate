/**
 * @file tests/unit/lib/apiClient.test.ts
 * @description Unit tests for the centralized API client wrapper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const makeFetchResponse = (status: number, body: any, ok?: boolean) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: ok ?? (status >= 200 && status < 300),
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockResolvedValue(JSON.parse(text)),
  } as any;
};

describe('apiClient', () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    vi.resetModules();
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('attaches bearer token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(200, { ok: true }));

    const { initApiClient, apiClient } = await import('../../../src/lib/apiClient');
    const unauthorized = vi.fn();
    initApiClient(() => 'token-123', unauthorized);

    const result = await apiClient.get('/v1/test');

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/v1/test', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
    }));
    expect(result).toEqual({ ok: true });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('invokes unauthorized handler on 401 and rejects', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(401, { error: 'expired' }, false));

    const { initApiClient, apiClient } = await import('../../../src/lib/apiClient');
    const unauthorized = vi.fn();
    initApiClient(() => 'token-abc', unauthorized);

    await expect(apiClient.get('/v1/protected')).rejects.toThrow(/Session expired/i);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it('throws when authenticated call is made without a token', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(200, {}));

    const { initApiClient, apiClient } = await import('../../../src/lib/apiClient');
    initApiClient(() => null, vi.fn());

    await expect(apiClient.get('/v1/needs-auth')).rejects.toThrow(/Not authenticated/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
