import { supabase } from "./supabaseClient";

export async function signIn(email: string, password: string) {
  console.log("SIGN IN CLICKED");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log("SIGN IN ERROR:", error.message);
    alert(error.message);
    return null;
  }

  console.log("SIGNED IN:", data.session);
  alert("Signed in successfully!");
  return data;
}

export async function signUp(
  email: string,
  password: string,
  name: string
) {
  console.log("SIGN UP CLICKED");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,   
      },
    },
  });

  if (error) {
    console.log("SIGN UP ERROR:", error.message);
    alert(error.message);
    return null;
  }

  console.log("SIGN UP SUCCESS:", data);
  alert("Account created! Check your email to confirm.");
  return data;
}
