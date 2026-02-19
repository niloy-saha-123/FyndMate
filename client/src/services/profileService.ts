import { supabase } from "../auth/supabaseClient";
import { apiClient } from "../lib/apiClient";
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_TAG_REGEX,
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_GITHUB_MAX_LENGTH,
  PROFILE_MAX_PROJECTS,
  PROFILE_MAX_EXPERIENCES,
  PROFILE_PROJECT_NAME_MAX_LENGTH,
  PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH,
  PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH,
  PROFILE_EXPERIENCE_POSITION_MAX_LENGTH,
  PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH,
} from "../constants/validation";
import type { UserProfile, ProjectItem, ExperienceItem } from "../types/profile";

export type { UserProfile };

// Your table is called "User", not "profiles"
const PROFILE_TABLE = "User";
const GITHUB_USERNAME_REGEX = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
const EXPERIENCE_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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
    projects: (row.projects ?? []).map((p: any) => ({
      id: p.id,
      name: p.name ?? p.title ?? '',
      description: p.description ?? '',
    })),
    experiences: (row.experiences ?? []).map((e: any) => ({
      id: e.id,
      company: e.company ?? '',
      position: e.position ?? '',
      description: e.description ?? null,
      startDate: e.startDate ?? null,
      endDate: e.endDate ?? null,
    })),
    age: row.age ?? null,
    birthDate: row.birthDate ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    gender: row.gender ?? null,
    githubUsername: row.githubUsername ?? null,
    lookingFor: row.interests ?? [],
    locationSharing: row.locationSharing ?? null,
    locationPermission: row.locationPermission ?? null,
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
    .select("id, name, fullName, birthDate, gender, onboardingCompleted, profilePicture, bio, skills, interests, githubUsername, location, city, country, locationSharing, locationPermission")
    .eq("supabaseId", supabaseId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) {
    const [projectsRes, experiencesRes] = await Promise.all([
      supabase
        .from('Project')
        .select('id, title, description')
        .eq('userId', data.id)
        .order('createdAt', { ascending: false })
        .limit(PROFILE_MAX_PROJECTS),
      supabase
        .from('Experience')
        .select('id, company, position, description, startDate, endDate')
        .eq('userId', data.id)
        .order('createdAt', { ascending: false })
        .limit(PROFILE_MAX_EXPERIENCES),
    ]);

    return normalizeProfile({
      ...data,
      projects: projectsRes.data ?? [],
      experiences: experiencesRes.data ?? [],
    });
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
    projects: [],
    experiences: [],
    age: null,
    birthDate: null,
    city: null,
    country: null,
    gender: null,
    githubUsername: null,
    lookingFor: [],
    locationSharing: null,
    locationPermission: null,
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
      const trimmed = s.trim();
      if (trimmed.length === 0) {
        throw new Error('Skill cannot be empty');
      }
      if (trimmed.length > PROFILE_TAG_MAX_LENGTH) {
        throw new Error(`Each skill must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
      }
      if (!PROFILE_TAG_REGEX.test(trimmed)) {
        throw new Error('Skill contains invalid characters');
      }
    }
  }
  if (payload.interests !== undefined) {
    if (payload.interests.length > PROFILE_MAX_INTERESTS) {
      throw new Error(`Maximum ${PROFILE_MAX_INTERESTS} interests allowed`);
    }
    for (const i of payload.interests) {
      const trimmed = i.trim();
      if (trimmed.length === 0) {
        throw new Error('Interest cannot be empty');
      }
      if (trimmed.length > PROFILE_TAG_MAX_LENGTH) {
        throw new Error(`Each interest must be ${PROFILE_TAG_MAX_LENGTH} characters or less`);
      }
      if (!PROFILE_TAG_REGEX.test(trimmed)) {
        throw new Error('Interest contains invalid characters');
      }
    }
  }
  if (payload.githubUsername !== undefined && payload.githubUsername !== null) {
    const username = payload.githubUsername.trim();
    if (username.length > PROFILE_GITHUB_MAX_LENGTH) {
      throw new Error(`GitHub username cannot exceed ${PROFILE_GITHUB_MAX_LENGTH} characters`);
    }
    if (username.length > 0 && !GITHUB_USERNAME_REGEX.test(username)) {
      throw new Error('GitHub username is invalid');
    }
  }
  if (payload.projects !== undefined) {
    if (payload.projects.length > PROFILE_MAX_PROJECTS) {
      throw new Error(`Maximum ${PROFILE_MAX_PROJECTS} projects allowed`);
    }
    for (const p of payload.projects as ProjectItem[]) {
      if (p.name.trim().length === 0) {
        throw new Error('Project name cannot be empty');
      }
      if (p.name.length > PROFILE_PROJECT_NAME_MAX_LENGTH) {
        throw new Error(`Project name cannot exceed ${PROFILE_PROJECT_NAME_MAX_LENGTH} characters`);
      }
      if (p.description.trim().length === 0) {
        throw new Error('Project description cannot be empty');
      }
      if (p.description.length > PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Project description cannot exceed ${PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH} characters`);
      }
    }
  }
  if (payload.experiences !== undefined) {
    if (payload.experiences.length > PROFILE_MAX_EXPERIENCES) {
      throw new Error(`Maximum ${PROFILE_MAX_EXPERIENCES} experiences allowed`);
    }
    for (const e of payload.experiences as ExperienceItem[]) {
      if (e.company.trim().length === 0) {
        throw new Error('Experience company cannot be empty');
      }
      if (e.company.length > PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH) {
        throw new Error(`Company cannot exceed ${PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH} characters`);
      }
      if (e.position.trim().length === 0) {
        throw new Error('Experience position cannot be empty');
      }
      if (e.position.length > PROFILE_EXPERIENCE_POSITION_MAX_LENGTH) {
        throw new Error(`Position cannot exceed ${PROFILE_EXPERIENCE_POSITION_MAX_LENGTH} characters`);
      }
      if (e.description && e.description.length > PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Experience description cannot exceed ${PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH} characters`);
      }
      const startRaw = e.startDate?.trim();
      const endRaw = e.endDate?.trim();
      if (!startRaw && endRaw) {
        throw new Error('Experience end date requires a start date');
      }
      if (startRaw && !EXPERIENCE_DATE_REGEX.test(startRaw)) {
        throw new Error('Experience start date must use YYYY-MM format');
      }
      if (endRaw && !EXPERIENCE_DATE_REGEX.test(endRaw)) {
        throw new Error('Experience end date must use YYYY-MM format');
      }

      const now = new Date();
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      if (startRaw && endRaw) {
        const start = new Date(`${startRaw}-01`);
        const end = new Date(`${endRaw}-01`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
          throw new Error('Experience end date cannot be before start date');
        }
        if (!Number.isNaN(start.getTime()) && start > currentMonth) {
          throw new Error('Experience start date cannot be in the future');
        }
        if (!Number.isNaN(end.getTime()) && end > currentMonth) {
          throw new Error('Experience end date cannot be in the future');
        }
      } else if (startRaw) {
        const start = new Date(`${startRaw}-01`);
        if (!Number.isNaN(start.getTime()) && start > currentMonth) {
          throw new Error('Experience start date cannot be in the future');
        }
      } else if (endRaw) {
        const end = new Date(`${endRaw}-01`);
        if (!Number.isNaN(end.getTime()) && end > currentMonth) {
          throw new Error('Experience end date cannot be in the future');
        }
      }
    }
  }
}

function normalizeExperienceDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export async function updateProfile(
  supabaseId: string,
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  validateProfilePayload(payload);
  // API expects fullName; map name -> fullName (omit name from request)
  const { name, ...rest } = payload;
  const { birthDate, ...restWithoutBirthDate } = rest;
  const normalizedBirthDate =
    typeof birthDate === 'string' && birthDate.trim().length === 0
      ? undefined
      : birthDate;
  const projects = rest.projects?.map((project) => ({
    name: project.name.trim(),
    description: project.description.trim(),
  }));
  const experiences = rest.experiences?.map((experience) => ({
    company: experience.company.trim(),
    position: experience.position.trim(),
    description: experience.description?.trim() || undefined,
    startDate: normalizeExperienceDate(experience.startDate),
    endDate: normalizeExperienceDate(experience.endDate),
  }));

  const apiPayload = {
    ...restWithoutBirthDate,
    ...(normalizedBirthDate !== undefined ? { birthDate: normalizedBirthDate } : {}),
    ...(name !== undefined ? { fullName: name } : {}),
    ...(projects !== undefined ? { projects } : {}),
    ...(experiences !== undefined ? { experiences } : {}),
  };
  const result = await apiClient.patch<any>("/api/profile/me", apiPayload);
  return normalizeProfile(result);
}

export async function getUserProfileById(userId: string): Promise<UserProfile> {
  const result = await apiClient.get<any>(`/api/profile/${userId}`);
  return normalizeProfile(result);
}

export async function deleteMyAccount(): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>('/api/profile/me');
}
