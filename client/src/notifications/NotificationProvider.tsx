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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [notificationsReady, setNotificationsReady] = useState(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshPushToken = useCallback(async () => {
    if (!user || !notificationsEnabled) return;

    try {
      const token = await registerForPushNotifications();
      if (token) {
        console.log('📱 Push token refreshed:', token);
        await savePushToken(token);
        console.log('✅ Push token saved to database');
      }
    } catch (error) {
      console.error('❌ Failed to refresh push token:', error);
    }
  }, [user, notificationsEnabled]);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? '1' : '0');

    if (!user) return;

    if (!enabled) {
      try {
        await clearPushToken();
        console.log('✅ Push notifications disabled');
      } catch (error) {
        console.error('❌ Failed to disable push notifications:', error);
      }
      return;
    }

    try {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(token);
        console.log('✅ Push notifications enabled');
      } else {
        setNotificationsEnabledState(false);
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
      }
    } catch (error) {
      console.error('❌ Failed to enable push notifications:', error);
      setNotificationsEnabledState(false);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setNotificationsEnabledState(true);
      setNotificationsReady(false);
      return;
    }

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (!mounted) return;
        setNotificationsEnabledState(stored == null ? true : stored === '1');
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

    if (!notificationsEnabled) {
      clearPushToken().catch(err => {
        console.error('❌ Failed to clear push token during startup:', err);
      });
      return;
    }

    // Initial registration
    registerForPushNotifications()
      .then(async token => {
        if (token) {
          console.log('📱 Push token:', token);
          await savePushToken(token);
          console.log('✅ Push token saved for user:', user.id);
        } else {
          console.log('⚠️ No push token received (emulator or permissions denied)');
        }
      })
      .catch(err => console.error('❌ Push registration error:', err));

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
          matchId?: string;
        };

        if (data?.matchId) {
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
