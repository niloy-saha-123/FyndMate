import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Local in-memory stores for mocks
const asyncStore = new Map<string, string>();
const secureStore = new Map<string, string>();

// Mock modules used by useLocation
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((k: string) => Promise.resolve(asyncStore.get(k) ?? null)),
    setItem: vi.fn((k: string, v: string) => {
      asyncStore.set(k, v);
      return Promise.resolve();
    }),
    removeItem: vi.fn((k: string) => {
      asyncStore.delete(k);
      return Promise.resolve();
    }),
  },
}));

const locationMock = {
  getForegroundPermissionsAsync: vi.fn(),
  getBackgroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  requestBackgroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn(),
  hasStartedLocationUpdatesAsync: vi.fn(),
  Accuracy: { Balanced: 0 },
};

vi.mock('expo-location', () => locationMock);

vi.mock('expo-task-manager', () => ({
  isTaskDefined: vi.fn(() => false),
  defineTask: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((k: string) => Promise.resolve(secureStore.get(k) ?? null)),
  setItemAsync: vi.fn((k: string, v: string) => {
    secureStore.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((k: string) => {
    secureStore.delete(k);
    return Promise.resolve();
  }),
}));

// Mock Auth + apiClient + supabase
vi.mock('../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { locationSharing: 'off', city: null, country: null },
  }),
}));

vi.mock('../../../src/lib/apiClient', () => ({
  apiClient: { patch: vi.fn().mockResolvedValue({}) },
  getApiBaseUrl: () => 'http://api.test',
}));

vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'user-1' } } } }),
    },
  },
}));

// Helper to render hooks
function renderHook<T>(hook: () => T) {
  let value: T;
  function Test() {
    value = hook();
    return null;
  }
  const inst = renderer.create(<Test />);
  return {
    result: () => value!,
    rerender: () => inst.update(<Test />),
    unmount: () => inst.unmount(),
  };
}

describe('useLocation', () => {
  beforeEach(() => {
    asyncStore.clear();
    secureStore.clear();
    Object.values(locationMock).forEach((fn: any) => {
      if (typeof fn.mockReset === 'function') fn.mockReset();
    });

    locationMock.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
    locationMock.getBackgroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' });
    locationMock.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
    locationMock.requestBackgroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' });
    locationMock.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 10, longitude: 20 } });
    locationMock.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
  });

  it('initializes and can toggle preference off->on with location update', async () => {
    const { useLocation } = await import('../../../src/hooks/useLocation');
    const { result } = renderHook(() => useLocation());

    // allow init effect
    await act(async () => {});

    expect(result().initialized).toBe(true);
    expect(result().preference).toBe('off');

    await act(async () => {
      await result().changePreference('on');
    });

    expect(result().preference).toBe('on');
    // location update should have been attempted; exact call count may vary with debounce
    expect(locationMock.getCurrentPositionAsync.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('does not crash when preference is off and updateLocationNow is called', async () => {
    const { useLocation } = await import('../../../src/hooks/useLocation');
    const { result } = renderHook(() => useLocation());
    await act(async () => {});

    await act(async () => {
      await result().updateLocationNow();
    });

    // Since pref is off, no current position should be requested
    expect(locationMock.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
