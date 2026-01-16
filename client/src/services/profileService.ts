import { supabase } from "../auth/supabaseClient";

export type UserProfile = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  onboardingCompleted: boolean;
};

// Your table is called "User", not "profiles"
const PROFILE_TABLE = "User";

function normalizeProfile(row: any): UserProfile {
  return {
    id: row.id,
    fullName: row.fullName ?? row.name ?? "",
    birthDate: row.birthDate ?? null,
    gender: row.gender ?? null,
    onboardingCompleted: Boolean(row.onboardingCompleted),
  };
}

export async function getOrCreateProfile(
  supabaseId: string,
  defaults?: Partial<UserProfile>
): Promise<UserProfile> {
  // Query by supabaseId, not id
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select("id, name, fullName, birthDate, gender, onboardingCompleted")
    .eq("supabaseId", supabaseId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) {
    return normalizeProfile(data);
  }

  // If no User row exists, the auth trigger should have created it
  // Return a default profile - the user will complete onboarding
  console.log("No User row found for supabaseId:", supabaseId);
  return {
    id: supabaseId,
    fullName: defaults?.fullName ?? "",
    birthDate: null,
    gender: null,
    onboardingCompleted: false,
  };
}

export async function updateProfile(
  supabaseId: string,
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  // Map fullName to name if needed (your DB uses "name")
  const dbPayload: any = { ...payload };
  if (payload.fullName !== undefined) {
    dbPayload.name = payload.fullName;
    dbPayload.fullName = payload.fullName;
  }

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .update(dbPayload)
    .eq("supabaseId", supabaseId)
    .select("id, name, fullName, birthDate, gender, onboardingCompleted")
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}
