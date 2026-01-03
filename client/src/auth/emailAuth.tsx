import { supabase } from "./supabaseClient";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    throw error;
  }

  return data;
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