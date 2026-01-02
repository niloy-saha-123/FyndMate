import { supabase } from "../supabaseAdmin.js";

const BLOCKED_NAMES = [
  "admin",
  "root",
  "system",
  "support",
  "null",
  "undefined",
];

function isValidName(name: string) {
  const clean = name.trim().toLowerCase();

  if (clean.length < 2 || clean.length > 40) return false;
  if (!/^[a-zA-Z\s]+$/.test(clean)) return false;
  if (BLOCKED_NAMES.includes(clean)) return false;

  return true;
}

export async function signupUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}) {
  if (!isValidName(name)) {
    throw new Error("Invalid or reserved name");
  }

  const { data, error } =
    await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: name.trim(),
      },
      email_confirm: false,
    });

  if (error) throw error;

  return data;
}
