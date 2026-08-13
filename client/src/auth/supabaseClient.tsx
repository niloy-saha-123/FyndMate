import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { secureSessionStorage } from "./secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // React Native has no localStorage. Without an explicit adapter auth-js
    // falls back to in-memory storage, which drops the session on every cold
    // start and forces users to sign in again each launch.
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL bar to parse on native; the OAuth callback is handled explicitly
    // in googleOAuth.tsx / app/auth.tsx.
    detectSessionInUrl: false,
  },
});

// auth-js schedules token refresh with a timer, which the OS suspends while the
// app is backgrounded. Re-sync on foreground so a returning user isn't handed an
// expired access token.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
