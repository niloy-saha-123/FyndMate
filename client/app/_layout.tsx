import { Stack, router } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from "../src/auth/AuthProvider";
import { ApiClientInitializer } from "../src/components/ApiClientInitializer";
import { NotificationProvider } from '@/src/notifications/NotificationProvider';
import { supabase } from "../src/auth/supabaseClient";
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Un-comment this if you want to handle global auth redirects here
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
    <AuthProvider>
      <NotificationProvider>
        <ApiClientInitializer>
          <SafeAreaView style={styles.statusbar}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="app-gate" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </SafeAreaView>
        </ApiClientInitializer>
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  statusbar: {
    flex: 1,
    backgroundColor: '#000',
  }
});