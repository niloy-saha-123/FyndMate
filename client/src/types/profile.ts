/**
 * @file client/src/types/profile.ts
 * @description Shared UserProfile type - what others see (feed, matches, messages).
 *
 * Use this everywhere we display or pass profile data.
 * onboardingCompleted is only for "me" (current user) - used for auth/routing.
 */

export interface ProjectItem {
  id?: string;
  name: string;
  description: string;
}

export interface ExperienceItem {
  id?: string;
  company: string;
  position: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  profilePicture: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  projects: ProjectItem[];
  experiences: ExperienceItem[];
  age: number | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  githubUsername: string | null;
  lookingFor: string[];
  locationSharing: string | null;
  locationPermission?: string | null;
  /** Display string e.g. "City, Country" */
  location?: string | null;
  /** Only for current user - used for onboarding/auth routing. Never expose to others. */
  onboardingCompleted?: boolean;
}
