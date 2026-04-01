import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from "../src/auth/AuthProvider";
import { ApiClientInitializer } from "../src/components/ApiClientInitializer";
import { NotificationProvider } from '@/src/notifications/NotificationProvider';
import { LocationProvider } from '@/src/location/LocationProvider';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  /*
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          router.replace("/(tabs)");
        } else {
          router.replace("/login");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);
  */

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          <NotificationProvider>
            <ApiClientInitializer>
              {/* Global safe-area handling: screens should not add extra top inset unless they opt out intentionally. */}
              <SafeAreaView style={styles.statusbar}>
                <OfflineBanner />
                <Stack>
                  {/* Landing / welcome */}
                  <Stack.Screen
                    name="index"
                    options={{ headerShown: false }}
                  />

                  {/* Auth screens */}
                  <Stack.Screen
                    name="login"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="auth"
                    options={{ headerShown: false }}
                  />

                  {/* App gating / onboarding / main app */}
                  <Stack.Screen
                    name="app-gate"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />

                  {/* Message profile detail */}
                  <Stack.Screen
                    name="messages/profile/[userId]"
                    options={{ headerShown: false }}
                  />

                  {/* Legal */}
                  <Stack.Screen
                    name="terms"
                    options={{
                      headerShown: false,
                      presentation: 'transparentModal',
                      animation: 'slide_from_bottom',
                      contentStyle: { backgroundColor: 'transparent' },
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="privacy"
                    options={{
                      headerShown: false,
                      presentation: 'transparentModal',
                      animation: 'slide_from_bottom',
                      contentStyle: { backgroundColor: 'transparent' },
                      gestureEnabled: true,
                    }}
                  />
                </Stack>
              </SafeAreaView>
            </ApiClientInitializer>
          </NotificationProvider>
        </LocationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  statusbar: {
    flex: 1,
    backgroundColor: '#000',
  }
});
