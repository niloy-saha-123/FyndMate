/**
 * @file tests/unit/utils/computeAge.test.ts
 * @description Unit tests for the computeAge utility function
 */

import { describe, it, expect } from 'vitest';
import { computeAge } from '../../../src/utils/computeAge.js';

describe('computeAge', () => {
    /**
     * Should return null when input is null
     */
    it('returns null for null input', () => {
        const result = computeAge(null);
        expect(result).toBeNull();
    });

    /**
     * Should calculate correct age for a valid date
     */
    it('returns correct age for valid date', () => {
        // Born 25 years ago
        const birthDate = new Date();
        birthDate.setFullYear(birthDate.getFullYear() - 25);
        birthDate.setMonth(0, 1); // Jan 1

        const result = computeAge(birthDate);
        expect(result).toBe(25);
    });

    /**
     * Should return age - 1 when birthday hasn't happened yet this year
     */
    it('returns age - 1 when birthday has not occurred this year', () => {
        const today = new Date();
        const birthDate = new Date();
        birthDate.setFullYear(today.getFullYear() - 25);
        // Set birthday to next month
        birthDate.setMonth(today.getMonth() + 1, 15);

        const result = computeAge(birthDate);
        expect(result).toBe(24);
    });

    /**
     * Should return exact age when birthday is today
     */
    it('returns exact age when birthday is today', () => {
        const today = new Date();
        const birthDate = new Date();
        birthDate.setFullYear(today.getFullYear() - 30);
        birthDate.setMonth(today.getMonth(), today.getDate());

        const result = computeAge(birthDate);
        expect(result).toBe(30);
    });

    /**
     * Should handle January 1st boundary correctly
     */
    it('handles January 1st boundary', () => {
        const birthDate = new Date('2000-01-01');
        const result = computeAge(birthDate);

        const currentYear = new Date().getFullYear();
        const expectedAge = currentYear - 2000;
        const today = new Date();

        if (today.getMonth() === 0 && today.getDate() >= 1) {
            expect(result).toBe(expectedAge);
        } else {
            expect(result).toBe(expectedAge);
        }
    });

    /**
     * Should handle leap year birthday (Feb 29)
     */
    it('handles leap year birthday February 29', () => {
        const birthDate = new Date('2000-02-29'); // Leap year
        const result = computeAge(birthDate);

        expect(result).toBeGreaterThanOrEqual(23); // At least 23 in 2024
    });

    /**
     * Should return negative age for future dates
     */
    it('returns negative age for future dates', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 5);

        const result = computeAge(futureDate);
        expect(result).toBeLessThan(0);
    });

    /**
     * Should handle very old dates (e.g., 1900)
     */
    it('handles very old dates like 1900', () => {
        const birthDate = new Date('1900-01-01');
        const result = computeAge(birthDate);

        const currentYear = new Date().getFullYear();
        expect(result).toBeGreaterThan(100);
        expect(result).toBeLessThanOrEqual(currentYear - 1900);
    });
});
