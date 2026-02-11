import { supabase } from "../auth/supabaseClient";
import { apiClient } from "../lib/apiClient";
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_GITHUB_MAX_LENGTH,
} from "../constants/validation";
import type { UserProfile } from "../types/profile";

export type { UserProfile };

// Your table is called "User", not "profiles"
const PROFILE_TABLE = "User";

function normalizeProfile(row: any): UserProfile {
  const name = row.fullName ?? row.name ?? "";
  const displayLocation = row.city && row.country
    ? `${row.city}, ${row.country}`
    : row.location ?? null;

  return {
    id: row.id,
    name,
    profilePicture: row.profilePicture ?? null,
    bio: row.bio ?? null,
    skills: row.skills ?? [],
    interests: row.interests ?? [],
    experience: row.experience ?? null,
    commitment: row.commitment ?? null,
    age: row.age ?? null,
    birthDate: row.birthDate ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    gender: row.gender ?? null,
    githubUsername: row.githubUsername ?? null,
    lookingFor: row.lookingFor ?? row.interests ?? [],
    locationSharing: row.locationSharing ?? null,
    location: displayLocation,
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
    .select("id, name, fullName, birthDate, gender, onboardingCompleted, profilePicture, bio, skills, interests, experience, commitment, githubUsername, location, city, country, locationSharing")
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
    name: defaults?.name ?? "",
    profilePicture: null,
    bio: null,
    skills: [],
    interests: [],
    experience: null,
    commitment: null,
    age: null,
    birthDate: null,
    city: null,
    country: null,
    gender: null,
    githubUsername: null,
    lookingFor: [],
    locationSharing: null,
    location: null,
    onboardingCompleted: false,
  };
}

/**
 * Validate profile payload against shared limits before API call.
 * Provides immediate feedback and avoids round-trip for invalid data.
 */
function validateProfilePayload(payload: Partial<UserProfile>): void {
  const name = payload.name ?? (payload as any).fullName;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length > PROFILE_NAME_MAX_LENGTH) {
      throw new Error(`Name cannot exceed ${PROFILE_NAME_MAX_LENGTH} characters`);
    }
  }
  if (payload.bio !== undefined && payload.bio !== null) {
    if (payload.bio.length > PROFILE_BIO_MAX_LENGTH) {
      throw new Error(`Bio cannot exceed ${PROFILE_BIO_MAX_LENGTH} characters`);
    }
  }
  if (payload.skills !== undefined) {
    if (payload.skills.length > PROFILE_MAX_SKILLS) {
      throw new Error(`Maximum ${PROFILE_MAX_SKILLS} skills allowed`);
    }
    for (const s of payload.skills) {
      if (s.length > PROFILE_TAG_MAX_LENGTH) {
        throw new Error(`Each skill must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
      }
    }
  }
  if (payload.interests !== undefined) {
    if (payload.interests.length > PROFILE_MAX_INTERESTS) {
      throw new Error(`Maximum ${PROFILE_MAX_INTERESTS} interests allowed`);
    }
    for (const i of payload.interests) {
      if (i.length > PROFILE_TAG_MAX_LENGTH) {
        throw new Error(`Each interest must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
      }
    }
  }
  if (payload.githubUsername !== undefined && payload.githubUsername !== null && payload.githubUsername.length > PROFILE_GITHUB_MAX_LENGTH) {
    throw new Error(`GitHub username cannot exceed ${PROFILE_GITHUB_MAX_LENGTH} characters`);
  }
}

export async function updateProfile(
  supabaseId: string,
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  validateProfilePayload(payload);
  // API expects fullName; map name -> fullName (omit name from request)
  const { name, ...rest } = payload;
  const apiPayload = name !== undefined ? { ...rest, fullName: name } : rest;
  const result = await apiClient.patch<any>("/api/profile/me", apiPayload);
  return normalizeProfile(result);
}
