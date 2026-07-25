/**
 * @file tests/unit/auth/emailAuth.test.ts
 * @description Unit tests for email/password auth flow handling in the client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => signInWithPassword(...args),
      signUp: (...args: any[]) => signUp(...args),
    },
  },
}));

describe('emailAuth', () => {
  const alertMock = vi.fn();

  beforeEach(() => {
    signInWithPassword.mockReset();
    signUp.mockReset();
    alertMock.mockReset();
    (globalThis as any).alert = alertMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signIn', () => {
    it('returns session data on success', async () => {
      signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'at123' } },
        error: null,
      });

      const { signIn } = await import('../../../src/auth/emailAuth');
      const result = await signIn('user@example.com', 'password123');

      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result).toEqual({ session: { access_token: 'at123' } });
      expect(alertMock).not.toHaveBeenCalled();
    });

    it('alerts and throws on error', async () => {
      signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const { signIn } = await import('../../../src/auth/emailAuth');

      await expect(signIn('user@example.com', 'wrong')).rejects.toEqual({
        message: 'Invalid login credentials',
      });
      expect(alertMock).toHaveBeenCalledWith('Invalid login credentials');
    });
  });

  describe('signUp', () => {
    it('creates an account and alerts success', async () => {
      signUp.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const { signUp: signUpFn } = await import('../../../src/auth/emailAuth');
      const result = await signUpFn('user@example.com', 'password123', 'Jane Doe');

      expect(signUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
        options: { data: { full_name: 'Jane Doe' } },
      });
      expect(result).toEqual({ user: { id: 'user-1' } });
      expect(alertMock).toHaveBeenCalledWith('Account created! Check your email.');
    });

    it('alerts and throws on error without success alert', async () => {
      signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      const { signUp: signUpFn } = await import('../../../src/auth/emailAuth');

      await expect(
        signUpFn('user@example.com', 'password123', 'Jane Doe')
      ).rejects.toEqual({ message: 'User already registered' });
      expect(alertMock).toHaveBeenCalledTimes(1);
      expect(alertMock).toHaveBeenCalledWith('User already registered');
    });
  });
});
