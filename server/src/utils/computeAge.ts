/**
 * @file src/utils/computeAge.ts
 * @description Computes a user's age from their birth date using UTC dates.
 */

export function computeAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}
