import { supabase } from "./supabaseClient";

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
