/**
 * @file src/utils/computeAge.ts
 * @description Computes a user's age from their birth date using UTC dates.
 */

export function computeAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = now.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
        age--;
    }
    return age;
}
