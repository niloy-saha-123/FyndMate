import { supabase } from "../auth/supabaseClient";

export type UserProfile = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  onboardingCompleted: boolean;
};

const PROFILE_TABLE = "profiles";

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
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select("id, fullName, birthDate, gender, onboardingCompleted")
    .eq("id", supabaseId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) {
    return normalizeProfile(data);
  }

  const { data: inserted, error: insertError } = await supabase
    .from(PROFILE_TABLE)
    .upsert(
      {
        id: supabaseId,
        fullName: defaults?.fullName ?? "",
        birthDate: defaults?.birthDate ?? null,
        gender: defaults?.gender ?? null,
        onboardingCompleted: defaults?.onboardingCompleted ?? false,
      },
      { onConflict: "id" }
    )
    .select("id, fullName, birthDate, gender, onboardingCompleted")
    .single();

  if (insertError) {
    throw insertError;
  }

  return normalizeProfile(inserted);
}

export async function updateProfile(
  supabaseId: string,
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert({ id: supabaseId, ...payload }, { onConflict: "id" })
    .select("id, fullName, birthDate, gender, onboardingCompleted")
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}
