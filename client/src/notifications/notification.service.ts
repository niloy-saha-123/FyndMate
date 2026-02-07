import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../auth/supabaseClient';
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

export async function savePushToken(userId: string, token: string) {
  console.log('📱 Saving push token for user:', userId);
  const { data, error } = await supabase
    .from('User')
    .update({
      pushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, pushToken')
    .single();

  if (error) {
    console.error('❌ Error saving push token:', error);
    throw error;
  }
  
  console.log('✅ Push token saved successfully:', data);
  return data;
}

// Debug function to verify push token is saved
export async function verifyPushTokenSaved(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('User')
    .select('pushToken, pushTokenUpdatedAt')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('❌ Error verifying push token:', error);
    return false;
  }
  
  console.log('📱 User push token status:', {
    hasToken: !!data?.pushToken,
    tokenPrefix: data?.pushToken?.substring(0, 30) + '...',
    updatedAt: data?.pushTokenUpdatedAt
  });
  
  return !!data?.pushToken;
}

// Debug function to test push notification directly
export async function debugSendPush(receiverUserId: string, message: string) {
  const result = await apiClient.post<{ success: boolean; result?: any; reason?: string; error?: string }>(
    '/api/notifications/send',
    { receiverUserId, message, title: 'Test Push' }
  );
  return result;
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
