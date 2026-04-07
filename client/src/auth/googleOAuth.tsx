import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabaseClient";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();
const AUTH_DEBUG = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_AUTH === "1";

function debugLog(...args: unknown[]) {
  if (!AUTH_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

function redactCallbackTokens(rawUrl: string): string {
  return rawUrl
    .replace(/(access_token=)[^&#]+/gi, "$1[redacted]")
    .replace(/(refresh_token=)[^&#]+/gi, "$1[redacted]");
}

export async function signInWithGoogle() {
  try {
    const redirectUrl = 'fyndmate://auth';

    debugLog("=== GOOGLE SIGN IN ===");
    debugLog("Redirect URL:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        // Always show Google account chooser, even if a session exists
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      console.error("OAuth error:", error);
      throw error;
    }

    if (!data?.url) {
      throw new Error("No OAuth URL returned");
    }

    debugLog("Opening browser...");

    // Open the browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    debugLog("=== BROWSER RESULT ===");
    debugLog("Type:", result.type);
    
    if (result.type === 'success' && result.url) {
      debugLog("OAuth callback URL received");

      // Parse the URL
      const url = result.url;
      let access_token: string | null = null;
      let refresh_token: string | null = null;

      // Check hash fragment
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hash = url.substring(hashIndex + 1);
        debugLog("Hash fragment present");
        const params = new URLSearchParams(hash);
        access_token = params.get('access_token');
        refresh_token = params.get('refresh_token');
      }

      // Check query params
      if (!access_token) {
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const endIndex = hashIndex !== -1 ? hashIndex : url.length;
          const query = url.substring(queryIndex + 1, endIndex);
          debugLog("Query params present");
          const params = new URLSearchParams(query);
          access_token = params.get('access_token');
          refresh_token = params.get('refresh_token');
        }
      }

      debugLog("Tokens found:", { access: !!access_token, refresh: !!refresh_token });

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) throw sessionError;

        debugLog("✅ Session set successfully!");
        router.replace("/app-gate");
        return;
      }
    }

    // Fallback: Check if session exists (deep link may have handled it)
    // This covers flows where the browser is dismissed but a deep link
    // handler (e.g. AuthRedirect screen) has already created a session.
    debugLog("Checking for existing session...");
    await new Promise(r => setTimeout(r, 1500));
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      debugLog("✅ Session found!");
      router.replace("/app-gate");
      return;
    }

    // If the user explicitly cancelled or dismissed the browser, treat it as
    // a normal user action, not an error. This avoids noisy alerts when a
    // user decides not to pick an account.
    if (result.type === 'cancel' || result.type === 'dismiss') {
      debugLog("User cancelled Google sign-in flow (type:", result.type, ")");
      return;
    }

    // At this point, we did not get tokens and we have no session, and the
    // browser result was not a user-driven cancel/dismiss. Surface a real
    // error so it can be debugged.
    const urlToShow = result.type === 'success' && result.url
      ? redactCallbackTokens(result.url)
      : 'N/A';
    throw new Error(
      `OAuth callback didn't return tokens.\n\nCallback URL: ${urlToShow.substring(0, 150)}...\n\nPlease check Metro logs.`
    );
  } catch (e: any) {
    console.error("OAuth error:", e);
    alert(e.message);
  }
}
