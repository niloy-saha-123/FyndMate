import { supabase } from "../auth/supabaseClient";

export type UserProfile = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  onboardingCompleted: boolean;
  profilePicture: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  commitment: string | null;
  githubUsername: string | null;
  location: string | null;
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
    profilePicture: row.profilePicture ?? null,
    bio: row.bio ?? null,
    skills: row.skills ?? [],
    interests: row.interests ?? [],
    experience: row.experience ?? null,
    commitment: row.commitment ?? null,
    githubUsername: row.githubUsername ?? null,
    location: row.location ?? null,
  };
}

export async function getOrCreateProfile(
  supabaseId: string,
  defaults?: Partial<UserProfile>
): Promise<UserProfile> {
  // Query by supabaseId, not id
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select("id, name, fullName, birthDate, gender, onboardingCompleted, profilePicture, bio, skills, interests, experience, commitment, githubUsername, location")
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
    profilePicture: null,
    bio: null,
    skills: [],
    interests: [],
    experience: null,
    commitment: null,
    githubUsername: null,
    location: null,
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
    .select("id, name, fullName, birthDate, gender, onboardingCompleted, profilePicture, bio, skills, interests, experience, commitment, githubUsername, location")
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}
