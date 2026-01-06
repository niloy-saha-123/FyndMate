import { supabase } from "./supabaseClient";
import { router } from "expo-router";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:3000";

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      throw error;
    }

    // Navigate to main app after successful sign in
    router.replace("/(tabs)");
    return data;
  } catch (e: any) {
    console.error("Sign in error:", e);
    throw e;
  }
}


export async function signUp(
  email: string,
  password: string,
  name: string
) {
  try {
    console.log("Signing up with API URL:", API_URL);
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Signup failed");
      throw new Error(data.error);
    }

    alert("Account created! Check your email.");
    return data;
  } catch (e: any) {
    console.error("Sign up error:", e);
    if (e.message === "Network request failed") {
      alert("Cannot connect to server. Make sure the server is running.");
    }
    throw e;
  }
}
