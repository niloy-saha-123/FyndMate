import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../src/auth/supabaseClient";
import * as Linking from "expo-linking";

export default function AuthRedirect() {
  const AUTH_DEBUG = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_AUTH === "1";
  const debugLog = (...args: unknown[]) => {
    if (!AUTH_DEBUG) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  };

  const router = useRouter();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const processAuthUrl = async (url: string) => {
      if (!url || processed) return;

      debugLog("Processing auth callback URL");

      let access_token = null;
      let refresh_token = null;

      if (url.includes('#')) {
        const hashPart = url.split('#')[1];
        debugLog("Hash fragment present");
        const hashParams = new URLSearchParams(hashPart);
        access_token = hashParams.get('access_token');
        refresh_token = hashParams.get('refresh_token');
      }

      if (!access_token && url.includes('?')) {
        const queryPart = url.split('?')[1]?.split('#')[0];
        debugLog("Query params present");
        const queryParams = new URLSearchParams(queryPart);
        access_token = queryParams.get('access_token');
        refresh_token = queryParams.get('refresh_token');
      }

      debugLog("Tokens found:", {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      });

      if (access_token && refresh_token) {
        setProcessed(true);
        debugLog("Setting session...");
        
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("Error setting session:", error.message);
          if (mounted) router.replace("/login");
          return;
        }

        debugLog("Session set successfully");
        if (mounted) router.replace("/app-gate");
      }
    };

    const handleAuthCallback = async () => {
      try {
        debugLog("=== AUTH CALLBACK STARTED ===");

        // Listen for incoming URLs 
        const subscription = Linking.addEventListener('url', async (event) => {
          debugLog("URL event received");
          await processAuthUrl(event.url);
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        const initialUrl = await Linking.getInitialURL();
        debugLog("Initial URL exists:", Boolean(initialUrl));
        
        if (initialUrl) {
          await processAuthUrl(initialUrl);
        }

        // If no tokens found after 3 seconds, check for session or redirect to login
        setTimeout(async () => {
          if (!processed && mounted) {
            debugLog("Timeout reached, checking session...");
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              debugLog("Session found");
              router.replace("/app-gate");
            } else {
              debugLog("No session, redirecting to login");
              router.replace("/login");
            }
          }
        }, 3000);

        return () => {
          subscription.remove();
        };
      } catch (e: any) {
        console.error("Auth callback exception:", e.message);
        if (mounted) router.replace("/login");
      }
    };

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [processed]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.text}>Completing sign in...</Text>
      <Text style={styles.subtext}>Please wait...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
