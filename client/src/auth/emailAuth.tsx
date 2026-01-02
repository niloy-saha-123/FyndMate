import { supabase } from "./supabaseClient";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

/* ---------------- SIGN IN (unchanged) ---------------- */

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

/* ---------------- SIGN UP (SECURE) ---------------- */

export async function signUp(
  email: string,
  password: string,
  name: string
) {
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
}
