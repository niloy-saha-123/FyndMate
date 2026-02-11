/**
 * @file client/src/types/profile.ts
 * @description Shared UserProfile type - what others see (feed, matches, chat).
 *
 * Use this everywhere we display or pass profile data.
 * onboardingCompleted is only for "me" (current user) - used for auth/routing.
 */

export interface UserProfile {
  id: string;
  name: string;
  profilePicture: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  commitment: string | null;
  age: number | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  githubUsername: string | null;
  lookingFor: string[];
  locationSharing: string | null;
  /** Display string e.g. "City, Country" */
  location?: string | null;
  /** Only for current user - used for onboarding/auth routing. Never expose to others. */
  onboardingCompleted?: boolean;
}
