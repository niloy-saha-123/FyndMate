/**
 * @file tests/unit/auth/AuthProvider.test.tsx
 * @description Unit tests for the AuthProvider session/user bootstrap flow.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn((_column: string, _value: string) => ({ maybeSingle }));
const select = vi.fn((_columns: string) => ({ eq }));
const from = vi.fn((_table: string) => ({ select }));
const getOrCreateProfile = vi.fn();
const fetchMyProfileWithToken = vi.fn();

vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => getSession(...args),
      onAuthStateChange: (...args: any[]) => onAuthStateChange(...args),
    },
    from: (table: string) => from(table),
  },
}));

vi.mock('../../../src/services/profileService', () => ({
  getOrCreateProfile: (...args: any[]) => getOrCreateProfile(...args),
  fetchMyProfileWithToken: (...args: any[]) => fetchMyProfileWithToken(...args),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function renderAuthProvider() {
  const { AuthProvider, useAuth } = await import('../../../src/auth/AuthProvider');
  let latest: any;
  function Consumer() {
    latest = useAuth();
    return null;
  }

  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await flush();
    await flush();
  });

  return { tree: tree!, getLatest: () => latest };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    getSession.mockReset();
    onAuthStateChange.mockReset();
    maybeSingle.mockReset();
    eq.mockClear();
    select.mockClear();
    from.mockClear();
    getOrCreateProfile.mockReset();
    fetchMyProfileWithToken.mockReset();

    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads user row and profile when a session exists', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'at123',
          user: { id: 'auth-1', user_metadata: { full_name: 'Jane Doe' } },
        },
      },
    });
    maybeSingle.mockResolvedValue({ data: { id: 'user-db-1' }, error: null });
    fetchMyProfileWithToken.mockResolvedValue({ id: 'user-db-1', name: 'Jane Doe' });

    const { getLatest } = await renderAuthProvider();
    const ctx = getLatest();

    expect(from).toHaveBeenCalledWith('User');
    expect(eq).toHaveBeenCalledWith('supabaseId', 'auth-1');
    expect(ctx.user).toEqual({ id: 'user-db-1', authId: 'auth-1' });
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.accessToken).toBe('at123');
    expect(ctx.loading).toBe(false);
    expect(ctx.profile).toEqual({ id: 'user-db-1', name: 'Jane Doe' });
    expect(getOrCreateProfile).not.toHaveBeenCalled();
  });

  it('clears user and profile when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const { getLatest } = await renderAuthProvider();
    const ctx = getLatest();

    expect(ctx.user).toBeNull();
    expect(ctx.profile).toBeNull();
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.loading).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to getOrCreateProfile when the API fetch fails', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'at123',
          user: { id: 'auth-1', user_metadata: { full_name: 'Jane Doe' } },
        },
      },
    });
    maybeSingle.mockResolvedValue({ data: { id: 'user-db-1' }, error: null });
    fetchMyProfileWithToken.mockRejectedValue(new Error('network error'));
    getOrCreateProfile.mockResolvedValue({ id: 'user-db-1', name: 'Jane Doe (fallback)' });

    const { getLatest } = await renderAuthProvider();
    const ctx = getLatest();

    expect(getOrCreateProfile).toHaveBeenCalledWith('auth-1', {
      name: 'Jane Doe',
      onboardingCompleted: false,
    });
    expect(ctx.profile).toEqual({ id: 'user-db-1', name: 'Jane Doe (fallback)' });
    expect(ctx.profileError).toBeNull();
  });
});
