import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { registerForPushNotifications, savePushToken } from './notification.service';
import { router } from 'expo-router';

interface NotificationContextType {}

const NotificationContext = createContext<NotificationContextType>({});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications()
      .then(async token => {
        if (token) {
          console.log('📱 Push token:', token);
          await savePushToken(user.id, token);
        }
      })
      .catch(console.error);

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('📬 Notification received:', notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped:', response);

        const data = response.notification.request.content.data as {
          matchId?: string;
        };

        if (data?.matchId) {
          router.push(`/(tabs)/chat/${data.matchId}`);
        }
      });

    // 4️⃣ Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
