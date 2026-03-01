/**
 * @file tests/unit/auth/googleOAuth.test.ts
 * @description Unit tests for Google OAuth flow handling in the client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const replaceMock = vi.fn();
const signInWithOAuth = vi.fn();
const setSession = vi.fn();
const getSession = vi.fn();
const openAuthSessionAsync = vi.fn();

// Mocks
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: (...args: any[]) => openAuthSessionAsync(...args),
}));

vi.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => replaceMock(...args) },
}));

vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: any[]) => signInWithOAuth(...args),
      setSession: (...args: any[]) => setSession(...args),
      getSession: (...args: any[]) => getSession(...args),
    },
  },
}));

describe('signInWithGoogle', () => {
  const originalEnv = { ...process.env };
  const alertMock = vi.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    replaceMock.mockReset();
    signInWithOAuth.mockReset();
    setSession.mockReset();
    getSession.mockReset();
    openAuthSessionAsync.mockReset();
    (globalThis as any).alert = alertMock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('completes OAuth and sets session when tokens are returned', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/auth' },
      error: null,
    });
    openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fyndmate://auth#access_token=at123&refresh_token=rt456',
    });
    setSession.mockResolvedValue({ data: { session: {} }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });

    const { signInWithGoogle } = await import('../../../src/auth/googleOAuth');
    await signInWithGoogle();

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: 'fyndmate://auth', skipBrowserRedirect: true }),
    });
    expect(openAuthSessionAsync).toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'at123',
      refresh_token: 'rt456',
    });
    expect(replaceMock).toHaveBeenCalledWith('/app-gate');
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('surfaces an error when no tokens are returned', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/auth' },
      error: null,
    });
    openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fyndmate://auth#no_tokens_here=true',
    });
    getSession.mockResolvedValue({ data: { session: null } });

    const { signInWithGoogle } = await import('../../../src/auth/googleOAuth');
    await signInWithGoogle();

    expect(setSession).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalled();
  });
});
