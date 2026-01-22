import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../auth/supabaseClient';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,      // Show banner at top
    shouldShowList: true,        // Show in notification list
    shouldPlaySound: true,       // Play sound
    shouldSetBadge: true,        // Show app badge
  }),
});

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
    console.log('Push notifications only work on physical devices');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('No EAS project ID found. Add it to app.json');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

export async function savePushToken(userId: string, token: string) {
  const { error } = await supabase
    .from('User')
    .update({
      pushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
}

export async function getNotificationPreference(
  matchId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('MatchNotificationPreference')
    .select('enabled')
    .eq('matchId', matchId)
    .eq('userId', userId)
    .maybeSingle();

  if (error) {
    console.error('Error getting notification preference:', error);
    throw error;
  }

  return data?.enabled ?? true;
}

export async function setNotificationPreference(
  matchId: string,
  userId: string,
  enabled: boolean
) {
  const { data, error } = await supabase
    .from('MatchNotificationPreference')
    .upsert(
      {
        matchId,
        userId,
        enabled,
        updatedAt: new Date().toISOString(),
      },
      {
        onConflict: 'matchId,userId',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error setting notification preference:', error);
    throw error;
  }

  return data;
}


export async function getAllNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('MatchNotificationPreference')
    .select('*')
    .eq('userId', userId);

  if (error) {
    console.error('Error getting all notification preferences:', error);
    throw error;
  }

  return data;
}