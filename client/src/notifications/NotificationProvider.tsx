import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { clearPushToken, registerForPushNotifications, savePushToken } from './notification.service';
import { router } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationContextType {
  refreshPushToken: () => Promise<void>;
  notificationsEnabled: boolean;
  notificationsReady: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  refreshPushToken: async () => { },
  notificationsEnabled: true,
  notificationsReady: false,
  setNotificationsEnabled: async () => { },
});

const NOTIFICATIONS_ENABLED_KEY = 'fyndmate_notifications_enabled';
const NOTIFICATIONS_LAST_TOKEN_KEY = 'fyndmate_notifications_last_token';
const NOTIFICATIONS_LAST_SYNC_KEY = 'fyndmate_notifications_last_sync';
const MIN_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [notificationsReady, setNotificationsReady] = useState(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastSavedTokenRef = useRef<string | null>(null);
  const lastSyncAtRef = useRef<number | null>(null);

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

  const ensureRegistered = useCallback(async (forceOpenSettingsOnDeny: boolean) => {
    if (!user || !notificationsEnabled) return;
    try {
      const token = await registerForPushNotifications(forceOpenSettingsOnDeny);
      if (token && shouldSyncToken(token)) {
        await savePushToken(token);
        await persistTokenState(token);
        console.log('✅ Push token saved to database');
      }
    } catch (error) {
      console.error('❌ Failed to refresh push token:', error);
    }
  }, [notificationsEnabled, persistTokenState, shouldSyncToken, user]);

  const refreshPushToken = useCallback(async () => {
    await ensureRegistered(false);
  }, [ensureRegistered]);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? '1' : '0');

    if (!user) return;

    if (!enabled) {
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
      await AsyncStorage.multiRemove([NOTIFICATIONS_LAST_TOKEN_KEY, NOTIFICATIONS_LAST_SYNC_KEY]).catch(() => {});
      try {
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
      } catch {
        //
      }
      return;
    }

    try {
      const token = await registerForPushNotifications(true);
      if (!token) {
        setNotificationsEnabledState(false);
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
        return;
      }

      if (shouldSyncToken(token)) {
        await savePushToken(token);
        await persistTokenState(token);
      }
      console.log('✅ Push notifications enabled');
    } catch (error) {
      console.error('❌ Failed to enable push notifications:', error);
      setNotificationsEnabledState(false);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
    }
  }, [persistTokenState, shouldSyncToken, user]);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setNotificationsEnabledState(true);
      setNotificationsReady(false);
      return;
    }

    (async () => {
      try {
        const [storedEnabled, storedToken, storedSync] = await AsyncStorage.multiGet([
          NOTIFICATIONS_ENABLED_KEY,
          NOTIFICATIONS_LAST_TOKEN_KEY,
          NOTIFICATIONS_LAST_SYNC_KEY,
        ]);
        if (!mounted) return;
        setNotificationsEnabledState(storedEnabled?.[1] == null ? true : storedEnabled[1] === '1');
        lastSavedTokenRef.current = storedToken?.[1] || null;
        lastSyncAtRef.current = storedSync?.[1] ? Number(storedSync[1]) : null;
      } finally {
        if (mounted) {
          setNotificationsReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !notificationsReady) return;

    if (!notificationsEnabled) return;

    // Initial registration
    ensureRegistered(false);

    // Refresh token when app comes to foreground (token can expire)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - refresh token
        refreshPushToken();
      }
      appStateRef.current = nextAppState;
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
  }, [user, notificationsEnabled, notificationsReady, refreshPushToken]);

  return (
    <NotificationContext.Provider
      value={{
        refreshPushToken,
        notificationsEnabled,
        notificationsReady,
        setNotificationsEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
