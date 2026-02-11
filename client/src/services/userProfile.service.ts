/**
 * @file client/src/services/userProfile.service.ts
 * @description Service to fetch user profile information for chat profile modals
 */

import { apiClient } from "../lib/apiClient";

export interface UserProfileData {
  id: string;
  name: string;
  profilePicture: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  commitment: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  githubUsername: string | null;
  lookingFor: string[];
  birthDate: string | null;
}

/**
 * Fetch user profile data by user ID
 * @param userId - The ID of the user to fetch
 * @returns UserProfileData
 */
export async function getUserProfile(userId: string): Promise<UserProfileData> {
  try {
    const response = await apiClient.get<UserProfileData>(`/api/users/${userId}`);
    return response;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    throw error;
  }
}