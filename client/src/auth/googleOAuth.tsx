import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabaseClient";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  try {
    const redirectUrl = 'fyndmate://auth';
    
    console.log("=== GOOGLE SIGN IN ===");
    console.log("Redirect URL:", redirectUrl);

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

    console.log("Opening browser...");

    // Open the browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    console.log("=== BROWSER RESULT ===");
    console.log("Type:", result.type);
    
    if (result.type === 'success') {
      console.log("Full URL:", result.url);
      
      // Parse the URL
      const url = result.url;
      let access_token: string | null = null;
      let refresh_token: string | null = null;

      // Check hash fragment
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hash = url.substring(hashIndex + 1);
        console.log("Hash fragment:", hash.substring(0, 100));
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
          console.log("Query params:", query.substring(0, 100));
          const params = new URLSearchParams(query);
          access_token = params.get('access_token');
          refresh_token = params.get('refresh_token');
        }
      }

      console.log("Tokens found:", { access: !!access_token, refresh: !!refresh_token });

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) throw sessionError;

        console.log("✅ Session set successfully!");
        router.replace("/app-gate");
        return;
      }
    }

    // Fallback: Check if session exists (deep link may have handled it)
    console.log("Checking for existing session...");
    await new Promise(r => setTimeout(r, 1500));
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      console.log("✅ Session found!");
      router.replace("/app-gate");
      return;
    }

    if (result.type === 'cancel') {
      console.log("User cancelled");
      return;
    }

    // Show the actual URL for debugging
    const urlToShow = result.type === 'success' ? result.url : 'N/A';
    throw new Error(
      `OAuth callback didn't return tokens.\n\nCallback URL: ${urlToShow.substring(0, 150)}...\n\nPlease check Metro logs.`
    );
  } catch (e: any) {
    console.error("OAuth error:", e);
    alert(e.message);
  }
}