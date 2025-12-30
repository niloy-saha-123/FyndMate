import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabaseClient";

export async function signInWithGoogle() {
  
  try {
    await GoogleSignin.hasPlayServices();

    const result = await GoogleSignin.signIn();
    const idToken =
      (result as any)?.idToken ?? (result as any)?.data?.idToken;

    if (!idToken) throw new Error("No ID token returned from Google Sign-In");

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;

    console.log("SIGNED IN WITH GOOGLE", data);
  } 
  
  catch (err: any) {
    console.log("GOOGLE SIGN IN ERROR:", err?.message ?? err);
  }
}
