import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabaseClient";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'fyndmate',
      path: 'auth'
    });
    
    console.log("=== GOOGLE SIGN IN STARTED ===");
    console.log("REDIRECT URL:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, 
      },
    });

    if (error) {
      console.error("OAuth error:", error);
      throw error;
    }

    console.log("OAuth URL:", data?.url);

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      console.log("WebBrowser result:", result);

      if (result.type === 'success') {
        const url = result.url;
        console.log("Success URL:", url);

        let access_token = null;
        let refresh_token = null;

        if (url.includes('#')) {
          const hashPart = url.split('#')[1];
          const hashParams = new URLSearchParams(hashPart);
          access_token = hashParams.get('access_token');
          refresh_token = hashParams.get('refresh_token');
        }

        if (url.includes('?') && !access_token) {
          const queryPart = url.split('?')[1]?.split('#')[0];
          const queryParams = new URLSearchParams(queryPart);
          access_token = queryParams.get('access_token');
          refresh_token = queryParams.get('refresh_token');
        }

        console.log("Extracted tokens:", { 
          hasAccess: !!access_token, 
          hasRefresh: !!refresh_token 
        });

        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) {
            console.error("Session error:", sessionError);
            throw sessionError;
          }

          console.log("Session set successfully!");
          router.replace("/app-gate");
        } else {
          throw new Error("No tokens received from OAuth");
        }
      } else {
        console.log("Auth cancelled or failed:", result.type);
      }
    }
  } catch (e: any) {
    console.error("OAuth exception:", e);
    alert(e.message);
  }
}