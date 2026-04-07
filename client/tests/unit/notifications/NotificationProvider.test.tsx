/**
 * @file tests/unit/notifications/NotificationProvider.test.tsx
 * @description Unit tests for push notification provider behavior.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory storage
const asyncStore = new Map<string, string>();

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((k: string) => Promise.resolve(asyncStore.get(k) ?? null)),
    setItem: vi.fn((k: string, v: string) => {
      asyncStore.set(k, v);
      return Promise.resolve();
    }),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, asyncStore.get(k) ?? null]))
    ),
    multiSet: vi.fn((entries: [string, string][]) => {
      entries.forEach(([k, v]) => asyncStore.set(k, v));
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => asyncStore.delete(k));
      return Promise.resolve();
    }),
  },
}));

// Mock Notifications and AppState
const notificationHandlers: any = {};
vi.mock('expo-notifications', () => ({
  addNotificationReceivedListener: vi.fn((cb) => {
    notificationHandlers.received = cb;
    return { remove: vi.fn() };
  }),
  addNotificationResponseReceivedListener: vi.fn((cb) => {
    notificationHandlers.response = cb;
    return { remove: vi.fn() };
  }),
  setNotificationHandler: vi.fn(),
  AndroidImportance: {},
  AndroidNotificationVisibility: {},
}));

const appStateListeners: any[] = [];
vi.mock('react-native', () => ({
  ...vi.importActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, cb: any) => {
      appStateListeners.push(cb);
      return { remove: () => {} };
    },
  },
}));

// Mock notification service functions
const registerForPushNotifications = vi.fn();
const savePushToken = vi.fn();
const clearPushToken = vi.fn();

vi.mock('../../../src/notifications/notification.service', () => ({
  registerForPushNotifications: (...args: any[]) => registerForPushNotifications(...args),
  savePushToken: (...args: any[]) => savePushToken(...args),
  clearPushToken: (...args: any[]) => clearPushToken(...args),
}));

vi.mock('../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import { NotificationProvider, useNotifications } from '../../../src/notifications/NotificationProvider';

function renderWithProvider() {
  let ctx: ReturnType<typeof useNotifications> | undefined;
  function Test() {
    ctx = useNotifications();
    return null;
  }
  act(() => {
    renderer.create(
      <NotificationProvider>
        <Test />
      </NotificationProvider>
    );
  });
  return () => {
    if (!ctx) {
      throw new Error('Notification context not initialized');
    }
    return ctx;
  };
}

describe('NotificationProvider', () => {
  beforeEach(() => {
    asyncStore.clear();
    registerForPushNotifications.mockReset();
    savePushToken.mockReset();
    clearPushToken.mockReset();
    appStateListeners.length = 0;
  });

  it('enables notifications and saves token', async () => {
    registerForPushNotifications.mockResolvedValue('expo-token');
    savePushToken.mockResolvedValue({});

    const ctx = renderWithProvider();

    // initial hydration
    await act(async () => {});

    await act(async () => {
      await ctx().setNotificationsEnabled(true);
    });

    expect(registerForPushNotifications).toHaveBeenCalled();
    expect(savePushToken).toHaveBeenCalledWith('expo-token');
    expect(ctx().notificationsEnabled).toBe(true);
  });

  it('disables notifications and clears token', async () => {
    // First enable to set token state
    registerForPushNotifications.mockResolvedValue('token');
    savePushToken.mockResolvedValue({});
    const ctx = renderWithProvider();
    await act(async () => {
      await ctx().setNotificationsEnabled(true);
    });

    await act(async () => {
      await ctx().setNotificationsEnabled(false);
    });

    expect(clearPushToken).toHaveBeenCalled();
    expect(ctx().notificationsEnabled).toBe(false);
  });
});
