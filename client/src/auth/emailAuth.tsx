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


export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });

  if (error) {
    alert(error.message);
    throw error;
  }

  alert("Account created! Check your email.");
  return data;
}
