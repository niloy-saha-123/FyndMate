import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import {
  clearPushToken,
  getNotificationPermissionState,
  registerForPushNotifications,
  savePushToken,
} from './notification.service';
import { router } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queuePermissionPrompt } from '../permissions/permissionPromptQueue';

interface NotificationContextType {
  refreshPushToken: () => Promise<void>;
  notificationsEnabled: boolean;
  notificationsReady: boolean;
  /** False once the OS refuses to show the permission dialog again. */
  notificationsCanAskAgain: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  refreshPushToken: async () => { },
  notificationsEnabled: false,
  notificationsReady: false,
  notificationsCanAskAgain: false,
  setNotificationsEnabled: async () => { },
});

const NOTIFICATIONS_ENABLED_KEY = 'fyndmate_notifications_enabled';
const NOTIFICATIONS_PROMPTED_KEY = 'fyndmate_notifications_prompted';
const NOTIFICATIONS_LAST_TOKEN_KEY = 'fyndmate_notifications_last_token';
const NOTIFICATIONS_LAST_SYNC_KEY = 'fyndmate_notifications_last_sync';
const MIN_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // The user's own opt-in/opt-out choice, persisted locally.
  const [preferenceEnabled, setPreferenceEnabled] = useState(true);
  // The live OS permission. Kept separate from the preference because the OS can
  // revoke or grant it behind the app's back (system settings), and because a
  // stored "on" preference must never claim notifications work when they don't.
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastSavedTokenRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef<number | null>(null);
  // Guards the first-run prompt so re-renders and foreground events can't ask again.
  const hasPromptedRef = useRef(true);

  const notificationsEnabled = permissionGranted && preferenceEnabled;

  const persistTokenState = useCallback(async (token: string) => {
    lastSavedTokenRef.current = token;
    lastSyncAtRef.current = Date.now();
    await AsyncStorage.multiSet([
      [NOTIFICATIONS_LAST_TOKEN_KEY, token],
      [NOTIFICATIONS_LAST_SYNC_KEY, String(lastSyncAtRef.current)],
    ]).catch(() => {});
  }, []);

  const shouldSyncToken = useCallback((token: string | null) => {
    if (!token) return false;
    if (token !== lastSavedTokenRef.current) return true;
    if (!lastSyncAtRef.current) return true;
    return Date.now() - lastSyncAtRef.current > MIN_SYNC_INTERVAL_MS;
  }, []);

  const syncToken = useCallback(async (token: string | null) => {
    if (!token || !shouldSyncToken(token)) return;
    await savePushToken(token);
    await persistTokenState(token);
    console.log('✅ Push token saved to database');
  }, [persistTokenState, shouldSyncToken]);

  const applyPermissionState = useCallback(
    (state: { granted: boolean; canAskAgain: boolean }) => {
      setPermissionGranted(state.granted);
      setCanAskAgain(state.canAskAgain);
    },
    []
  );

  /**
   * Registers the push token without ever showing a dialog. Safe to call on
   * mount and on every foreground.
   */
  const refreshPushToken = useCallback(async () => {
    if (!user) return;
    try {
      const state = await getNotificationPermissionState();
      applyPermissionState(state);

      if (!state.granted) return;

      const storedPreference = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      if (storedPreference === '0') return;

      const token = await registerForPushNotifications({ prompt: false });
      await syncToken(token);
    } catch (error) {
      console.error('❌ Failed to refresh push token:', error);
    }
  }, [applyPermissionState, syncToken, user]);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      setPreferenceEnabled(false);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0').catch(() => {});

      if (!user) return;

      // Only clear once when transitioning from on -> off
      if (lastSavedTokenRef.current) {
        try {
          await clearPushToken();
          console.log('✅ Push notifications disabled');
        } catch (error) {
          console.error('❌ Failed to disable push notifications:', error);
        }
      }
      lastSavedTokenRef.current = null;
      lastSyncAtRef.current = null;
      await AsyncStorage.multiRemove([
        NOTIFICATIONS_LAST_TOKEN_KEY,
        NOTIFICATIONS_LAST_SYNC_KEY,
      ]).catch(() => {});
      return;
    }

    setPreferenceEnabled(true);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '1').catch(() => {});

    if (!user) return;

    try {
      // The user asked for this, so prompting (or bouncing them to system
      // settings when the OS won't prompt) is expected here.
      const token = await queuePermissionPrompt(() =>
        registerForPushNotifications({ prompt: true, openSettingsIfBlocked: true })
      );
      await AsyncStorage.setItem(NOTIFICATIONS_PROMPTED_KEY, '1').catch(() => {});
      hasPromptedRef.current = true;

      applyPermissionState(await getNotificationPermissionState());

      if (!token) return;

      await syncToken(token);
      console.log('✅ Push notifications enabled');
    } catch (error) {
      console.error('❌ Failed to enable push notifications:', error);
      applyPermissionState(await getNotificationPermissionState());
    }
  }, [applyPermissionState, syncToken, user]);

  // Hydrate stored state and the live OS permission for the signed-in user.
  useEffect(() => {
    let mounted = true;

    if (!user) {
      setPreferenceEnabled(true);
      setPermissionGranted(false);
      setCanAskAgain(false);
      setNotificationsReady(false);
      hasPromptedRef.current = true;
      return;
    }

    setNotificationsReady(false);

    (async () => {
      try {
        const [storedEnabled, storedPrompted, storedToken, storedSync] =
          await AsyncStorage.multiGet([
            NOTIFICATIONS_ENABLED_KEY,
            NOTIFICATIONS_PROMPTED_KEY,
            NOTIFICATIONS_LAST_TOKEN_KEY,
            NOTIFICATIONS_LAST_SYNC_KEY,
          ]);
        const permission = await getNotificationPermissionState();
        if (!mounted) return;

        setPreferenceEnabled(storedEnabled?.[1] == null ? true : storedEnabled[1] === '1');
        hasPromptedRef.current = storedPrompted?.[1] === '1';
        lastSavedTokenRef.current = storedToken?.[1] || null;
        lastSyncAtRef.current = storedSync?.[1] ? Number(storedSync[1]) : null;
        applyPermissionState(permission);
      } catch (error) {
        console.error('❌ Failed to load notification state:', error);
      } finally {
        if (mounted) setNotificationsReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [applyPermissionState, user?.id]);

  // First-run permission request. Runs at most once per install.
  useEffect(() => {
    if (!user || !notificationsReady) return;
    if (hasPromptedRef.current) return;
    if (permissionGranted || !canAskAgain || !preferenceEnabled) return;

    let mounted = true;
    // Claim the prompt synchronously so a re-render cannot queue a second one.
    hasPromptedRef.current = true;

    (async () => {
      try {
        const token = await queuePermissionPrompt(() =>
          registerForPushNotifications({ prompt: true })
        );
        await AsyncStorage.setItem(NOTIFICATIONS_PROMPTED_KEY, '1').catch(() => {});
        const permission = await getNotificationPermissionState();
        if (!mounted) return;
        applyPermissionState(permission);
        await syncToken(token);
      } catch (error) {
        console.error('❌ Notification permission request failed:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    applyPermissionState,
    canAskAgain,
    notificationsReady,
    permissionGranted,
    preferenceEnabled,
    syncToken,
    user,
  ]);

  // Token upkeep and notification handling. Never prompts.
  useEffect(() => {
    if (!user || !notificationsReady) return;

    if (permissionGranted && preferenceEnabled) {
      refreshPushToken();
    }

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const returningToForeground =
        !!appStateRef.current.match(/inactive|background/) && nextAppState === 'active';
      appStateRef.current = nextAppState;
      if (!returningToForeground) return;
      // Re-reads the OS permission so a change made in system settings is
      // picked up, and refreshes the token if it is still granted.
      refreshPushToken();
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('📬 Notification received:', JSON.stringify(notification.request.content, null, 2));
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped:', response);

        const data = response.notification.request.content.data as {
          type?: string;
          matchId?: string;
        };

        if (data?.type === 'request') {
          router.push('/(tabs)/likes');
          return;
        }

        if ((data?.type === 'message' || data?.type === 'match') && data?.matchId) {
          router.push(`/messages/${data.matchId}`);
        }
      });

    // Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      appStateSubscription.remove();
    };
  }, [notificationsReady, permissionGranted, preferenceEnabled, refreshPushToken, user]);

  return (
    <NotificationContext.Provider
      value={{
        refreshPushToken,
        notificationsEnabled,
        notificationsReady,
        notificationsCanAskAgain: canAskAgain,
        setNotificationsEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
