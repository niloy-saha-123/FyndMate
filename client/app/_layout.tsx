import { Stack, router } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from "../src/auth/AuthProvider";
import { supabase } from "../src/auth/supabaseClient";
import { useEffect } from 'react';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {

   useEffect(() => {

    GoogleSignin.configure({
      webClientId: "649865082382-v79tifarhtop4valejnlmcnnnn9ldtbs.apps.googleusercontent.com,649865082382-mo4fqt1d8m63uobsuhd0t3r7jkpaqdhs.apps.googleusercontent.com",
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("AUTH CHANGE", session);

        if (session) {
          router.replace("/(tabs)");
        } else {
          router.replace("/login");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (

      <AuthProvider>
        <SafeAreaView style={styles.statusbar}>
          <Stack>
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