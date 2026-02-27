/**
 * @file tests/test-utils/assertions.ts
 * @description Custom assertion helpers for common test patterns.
 *
 * Provides reusable assertion functions to check:
 * - No sensitive fields (latitude, longitude, locationSecret) leak in responses.
 * - Valid UUID format.
 * - Paginated response shape ({ data, nextCursor }).
 */
import { expect } from 'vitest';

/** Fields that must NEVER appear in any API response to clients. */
const SENSITIVE_FIELDS = new Set(['latitude', 'longitude', 'locationSecret']);

/**
 * Recursively checks that no sensitive location fields exist in a payload.
 * Throws a Vitest assertion error if any are found.
 */
export function assertNoSensitiveFields(payload: any, path = 'root'): void {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
        return;
    }

    if (Array.isArray(payload)) {
        payload.forEach((item, idx) => assertNoSensitiveFields(item, `${path}[${idx}]`));
        return;
    }

    for (const key of Object.keys(payload)) {
        if (SENSITIVE_FIELDS.has(key)) {
            throw new Error(
                `Sensitive field "${key}" found at ${path}.${key}. ` +
                    'This field must never be exposed in API responses.',
            );
        }
        if (typeof payload[key] === 'object') {
            assertNoSensitiveFields(payload[key], `${path}.${key}`);
        }
    }
}

/** UUID v4 regex pattern. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Asserts that a value is a valid UUID v4 string.
 */
export function assertValidUUID(value: string): void {
    expect(value).toMatch(UUID_REGEX);
}

/**
 * Asserts that a response body has the paginated shape: { data: Array, nextCursor: string | null }.
 */
export function assertPaginatedResponse(body: any): void {
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('nextCursor');
}
