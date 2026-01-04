import { Stack, router } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from "../src/auth/AuthProvider";
import { supabase } from "../src/auth/supabaseClient";
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {

   useEffect(() => {

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("AUTH CHANGE", session);

        if (session) {
          router.replace("/(tabs)");
        }
        // Don't auto-redirect to login - let the welcome screen handle that
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);
  
  return (

      <AuthProvider>
        <SafeAreaView style={styles.statusbar}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaView>
      </AuthProvider>
      
  );
}

const styles = StyleSheet.create({
  statusbar:{
    flex: 1,
    backgroundColor:'#000',
  }
});