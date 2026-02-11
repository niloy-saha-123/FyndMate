/**
 * @file tests/unit/utils/locationPrivacy.test.ts
 * @description Unit tests for location privacy utility functions
 */

import { describe, it, expect } from 'vitest';
import { filterLocationByPrivacy, filterLocationArrayByPrivacy } from '../../../src/utils/locationPrivacy.js';

describe('filterLocationByPrivacy', () => {
    /**
     * Should return user as-is when locationSharing is 'always'
     */
    it('returns user as-is when locationSharing is always', () => {
        const user = {
            id: '1',
            name: 'Alice',
            city: 'New York',
            country: 'USA',
            locationSharing: 'always',
        };

        const result = filterLocationByPrivacy(user);
        expect(result).toEqual(user);
        expect(result.city).toBe('New York');
        expect(result.country).toBe('USA');
    });

    /**
     * Should return user as-is when locationSharing is 'whileOpen'
     */
    it('returns user as-is when locationSharing is whileOpen', () => {
        const user = {
            id: '2',
            name: 'Bob',
            city: 'London',
            country: 'UK',
            locationSharing: 'whileOpen',
        };

        const result = filterLocationByPrivacy(user);
        expect(result.city).toBe('London');
        expect(result.country).toBe('UK');
    });

    /**
     * Should nullify city and country when locationSharing is 'never'
     */
    it('nullifies city/country when locationSharing is never', () => {
        const user = {
            id: '3',
            name: 'Charlie',
            city: 'Paris',
            country: 'France',
            locationSharing: 'never',
        };

        const result = filterLocationByPrivacy(user);
        expect(result.city).toBeNull();
        expect(result.country).toBeNull();
    });

    /**
     * Should preserve other fields when locationSharing is 'never'
     */
    it('preserves other fields (id, name) when locationSharing is never', () => {
        const user = {
            id: '4',
            name: 'Diana',
            city: 'Tokyo',
            country: 'Japan',
            locationSharing: 'never',
            bio: 'Software engineer',
        };

        const result = filterLocationByPrivacy(user);
        expect(result.id).toBe('4');
        expect(result.name).toBe('Diana');
        expect(result.bio).toBe('Software engineer');
    });

    /**
     * Should handle null locationSharing (returns as-is)
     */
    it('handles null locationSharing (returns as-is)', () => {
        const user = {
            id: '5',
            name: 'Eve',
            city: 'Berlin',
            country: 'Germany',
            locationSharing: null,
        };

        const result = filterLocationByPrivacy(user);
        expect(result.city).toBe('Berlin');
        expect(result.country).toBe('Germany');
    });

    /**
     * Should handle undefined locationSharing (returns as-is)
     */
    it('handles undefined locationSharing (returns as-is)', () => {
        const user = {
            id: '6',
            name: 'Frank',
            city: 'Madrid',
            country: 'Spain',
        };

        const result = filterLocationByPrivacy(user);
        expect(result.city).toBe('Madrid');
        expect(result.country).toBe('Spain');
    });
});

describe('filterLocationArrayByPrivacy', () => {
    /**
     * Should filter each user in the array
     */
    it('filters each user in the array', () => {
        const users = [
            { id: '1', name: 'Alice', city: 'NYC', country: 'USA', locationSharing: 'always' },
            { id: '2', name: 'Bob', city: 'London', country: 'UK', locationSharing: 'never' },
        ];

        const result = filterLocationArrayByPrivacy(users);
        expect(result[0].city).toBe('NYC');
        expect(result[1].city).toBeNull();
        expect(result[1].country).toBeNull();
    });

    /**
     * Should return empty array for empty input
     */
    it('returns empty array for empty input', () => {
        const result = filterLocationArrayByPrivacy([]);
        expect(result).toEqual([]);
    });
});
