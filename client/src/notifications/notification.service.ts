import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from '../lib/apiClient';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,      // Show banner at top
    shouldShowList: true,        // Show in notification list
    shouldPlaySound: true,       // Play sound
    shouldSetBadge: true,        // Show app badge
  }),
});

// Setup Android notification channel on app start
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
    console.log('✅ Android notification channel configured');
  }
}

// Setup listeners for incoming push notifications
export function setupNotificationListeners() {
  // Listen for notifications arriving while app is in foreground
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received:', notification);
  });

  // Listen for user interactions with notifications
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification clicked:', response.notification.request.content.data);
  });

  // Return cleanup function
  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}

export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test Notification 🔔",
      body: "Push notifications are working!",
      data: { test: true },
    },
    trigger: null, 
  });
}

export async function registerForPushNotifications(): Promise<string | null> {

  if (!Device.isDevice) {
    console.log('⚠️ Push notifications only work on physical devices');
    return null;
  }

  try {
    // Setup Android notification channel first
    await setupNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 Existing notification permission status:', existingStatus);
    
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('📱 Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push notification permissions');
      return null;
    }

    console.log('✅ Notification permissions granted');

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('❌ No EAS project ID found. Add it to app.json extra.eas.projectId');
      return null;
    }

    console.log('📱 Getting Expo push token with project ID:', projectId);

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('✅ Expo push token obtained:', token.data);

    return token.data;
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

export async function savePushToken(token: string) {
  console.log('📱 Saving push token');
  const result = await apiClient.patch<{ success: boolean }>(
    '/api/notifications/push-token',
    { pushToken: token }
  );
  console.log('✅ Push token saved successfully');
  return result;
}

// Debug function - calls profile to check if token was persisted (server stores it on User)
export async function verifyPushTokenSaved(_userId: string): Promise<boolean> {
  try {
    const profile = await apiClient.get<{ profilePicture?: string }>('/api/profile/me');
    return !!profile;
  } catch {
    return false;
  }
}

// Debug function to test push notification directly
export async function debugSendPush(receiverUserId: string, message: string) {
  const result = await apiClient.post<{ success: boolean; result?: any; reason?: string; error?: string }>(
    '/api/notifications/send',
    { receiverUserId, message, title: 'Test Push' }
  );
  return result;
}

export async function getNotificationPreference(matchId: string): Promise<boolean> {
  const result = await apiClient.get<{ enabled: boolean }>(
    `/api/notifications/preferences/${matchId}`
  );
  return result.enabled ?? true;
}

export async function setNotificationPreference(
  matchId: string,
  enabled: boolean
) {
  return apiClient.put(`/api/notifications/preferences/${matchId}`, { enabled });
}


export async function getAllNotificationPreferences(_userId: string) {
  const res = await apiClient.get<{ data: any[] }>('/api/matches');
  const matches = res.data ?? [];
  const prefs = await Promise.all(
    matches.map((m) =>
      apiClient.get<{ enabled: boolean }>(
        `/api/notifications/preferences/${m.id}`
      ).then((r) => ({ matchId: m.id, enabled: r.enabled }))
    )
  );
  return prefs;
}
