import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { registerForPushNotifications, savePushToken } from './notification.service';
import { router } from 'expo-router';
import { AppState, AppStateStatus, Platform } from 'react-native';

interface NotificationContextType {
  refreshPushToken: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  refreshPushToken: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshPushToken = async () => {
    if (!user) return;
    
    try {
      const token = await registerForPushNotifications();
      if (token) {
        console.log('📱 Push token refreshed:', token);
        await savePushToken(user.id, token);
        console.log('✅ Push token saved to database');
      }
    } catch (error) {
      console.error('❌ Failed to refresh push token:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Initial registration
    registerForPushNotifications()
      .then(async token => {
        if (token) {
          console.log('📱 Push token:', token);
          await savePushToken(user.id, token);
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
          router.push(`/chat/${data.matchId}`);
        }
      });

    // Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      appStateSubscription.remove();
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ refreshPushToken }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
