import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from '../lib/apiClient';

const NOTIFICATION_DEBUG = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_NOTIFICATIONS === '1';
const debugLog = (...args: unknown[]) => {
  if (!NOTIFICATION_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,       // Required by NotificationBehavior typing
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
    debugLog('✅ Android notification channel configured');
  }
}

// Setup listeners for incoming push notifications
export function setupNotificationListeners() {
  // Listen for notifications arriving while app is in foreground
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    debugLog('📬 Notification received');
  });

  // Listen for user interactions with notifications
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    debugLog('👆 Notification clicked', response.notification.request.identifier);
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

export type NotificationPermissionState = {
  granted: boolean;
  /** True when the OS is still willing to show the permission dialog. */
  canAskAgain: boolean;
  /** False on simulators/emulators, where push tokens cannot be issued. */
  supported: boolean;
};

/**
 * Reads the live OS notification permission. This is the only trustworthy
 * source for whether notifications actually work — a stored preference can say
 * "on" while the OS has the permission denied.
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!Device.isDevice) {
    return { granted: false, canAskAgain: false, supported: false };
  }

  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain: status !== 'granted' && canAskAgain,
      supported: true,
    };
  } catch (error) {
    console.error('❌ Failed to read notification permission:', error);
    return { granted: false, canAskAgain: false, supported: true };
  }
}

export type RegisterPushOptions = {
  /**
   * Show the OS permission dialog when permission is missing. Leave false for
   * automatic/background registration so the user is never re-prompted after
   * they have already declined.
   */
  prompt?: boolean;
  /**
   * When the OS refuses to show the dialog again, send the user to system
   * settings. Only appropriate when the user explicitly asked to turn
   * notifications on.
   */
  openSettingsIfBlocked?: boolean;
};

export async function registerForPushNotifications(
  options: RegisterPushOptions = {}
): Promise<string | null> {
  const { prompt = false, openSettingsIfBlocked = false } = options;

  if (!Device.isDevice) {
    debugLog('⚠️ Push notifications only work on physical devices');
    return null;
  }

  try {
    // Setup Android notification channel first
    await setupNotificationChannel();

    const existing = await Notifications.getPermissionsAsync();
    debugLog('📱 Existing notification permission status:', existing.status);

    let granted = existing.status === 'granted';

    if (!granted) {
      // Only the explicit user-driven path may open a dialog. Requesting here
      // on every automatic pass is what re-prompted users immediately after
      // they declined.
      if (!prompt) {
        debugLog('📱 Permission not granted and prompting is disabled; skipping');
        return null;
      }

      if (!existing.canAskAgain) {
        debugLog('📱 OS will not prompt again for notifications');
        if (openSettingsIfBlocked) {
          Linking.openSettings().catch(() => {});
        }
        return null;
      }

      debugLog('📱 Requesting notification permissions...');
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === 'granted';
    }

    if (!granted) {
      debugLog('❌ Failed to get push notification permissions');
      return null;
    }

    debugLog('✅ Notification permissions granted');

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('❌ No EAS project ID found. Add it to app.json extra.eas.projectId');
      return null;
    }

    debugLog('📱 Getting Expo push token with project ID:', projectId);

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const tokenPreview = token.data.length > 12
      ? `${token.data.slice(0, 6)}...${token.data.slice(-4)}`
      : 'masked';
    debugLog('✅ Expo push token obtained:', tokenPreview);

    return token.data;
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

export async function savePushToken(token: string) {
  debugLog('📱 Saving push token');
  const result = await apiClient.patch<{ success: boolean }>(
    '/api/notifications/push-token',
    { pushToken: token }
  );
  debugLog('✅ Push token saved successfully');
  return result;
}

export async function clearPushToken() {
  debugLog('📱 Clearing push token');
  return apiClient.delete<{ success: boolean }>('/api/notifications/push-token');
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
