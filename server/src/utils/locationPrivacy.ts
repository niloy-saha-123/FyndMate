/**
 * @file src/utils/locationPrivacy.ts
 * @description Utility functions for handling location privacy.
 * 
 * This module ensures that user location data is only exposed when the user
 * has explicitly allowed it via their `locationSharing` preference.
 * 
 * Privacy Rules:
 * - If locationSharing = "never" → hide city/country
 * - If locationSharing = "whileOpen" or "always" → show city/country
 * - NEVER expose latitude/longitude to other users (internal use only)
 */

export interface UserWithLocation {
    city?: string | null;
    country?: string | null;
    locationSharing?: string | null;
    [key: string]: any;
}

/**
 * Filters location data based on user's privacy preference.
 * 
 * @param user - User object with location fields
 * @returns User object with location fields filtered based on locationSharing
 * 
 * @example
 * const user = await prisma.user.findUnique({ where: { id } });
 * const publicProfile = filterLocationByPrivacy(user);
 * // If user.locationSharing === "never", publicProfile.city and publicProfile.country will be null
 */
export function filterLocationByPrivacy<T extends UserWithLocation>(user: T): T {
    // If user has disabled location sharing, hide city and country
    if (user.locationSharing === 'never') {
        return {
            ...user,
            city: null,
            country: null,
        };
    }

    // Otherwise, return as-is (city and country are visible)
    return user;
}

/**
 * Filters an array of users, applying location privacy to each.
 * 
 * @param users - Array of user objects
 * @returns Array of users with location privacy applied
 * 
 * @example
 * const users = await prisma.user.findMany();
 * const publicProfiles = filterLocationArrayByPrivacy(users);
 */
export function filterLocationArrayByPrivacy<T extends UserWithLocation>(users: T[]): T[] {
    return users.map(filterLocationByPrivacy);
}
