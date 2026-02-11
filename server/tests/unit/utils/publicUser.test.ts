/**
 * @file tests/unit/utils/publicUser.test.ts
 * @description Unit tests for public user select objects
 */

import { describe, it, expect } from 'vitest';
import {
    publicUserFeedSelect,
    publicUserLikeSelect,
    publicUserMatchSelect
} from '../../../src/utils/publicUser.js';

describe('publicUser selects', () => {
    /**
     * Should not include sensitive location fields in publicUserFeedSelect
     */
    it('publicUserFeedSelect does NOT include latitude/longitude/locationSecret', () => {
        const keys = Object.keys(publicUserFeedSelect);

        expect(keys).not.toContain('latitude');
        expect(keys).not.toContain('longitude');
        expect(keys).not.toContain('locationSecret');

        // Should include safe fields
        expect(keys).toContain('id');
        expect(keys).toContain('name');
        expect(keys).toContain('city');
        expect(keys).toContain('country');
    });

    /**
     * Should only include id, name, and profilePicture in publicUserLikeSelect
     */
    it('publicUserLikeSelect only has id/name/profilePicture', () => {
        const keys = Object.keys(publicUserLikeSelect);

        expect(keys).toContain('id');
        expect(keys).toContain('name');
        expect(keys).toContain('profilePicture');
        expect(keys.length).toBe(3);
    });

    /**
     * Should only include id, name, and profilePicture in publicUserMatchSelect
     */
    it('publicUserMatchSelect only has id/name/profilePicture', () => {
        const keys = Object.keys(publicUserMatchSelect);

        expect(keys).toContain('id');
        expect(keys).toContain('name');
        expect(keys).toContain('profilePicture');
        expect(keys.length).toBe(3);
    });
});
