/**
 * @file tests/unit/utils/errorMessages.test.ts
 * @description Unit tests for user-friendly error message helpers.
 */
import { describe, it, expect } from 'vitest';
import { getUserFriendlyErrorMessage } from '../../../src/utils/errorMessages';

describe('getUserFriendlyErrorMessage', () => {
  it('maps network-style failures', () => {
    expect(getUserFriendlyErrorMessage(new Error('Network request failed'))).toBe(
      "Couldn't connect. Check your internet connection."
    );
    expect(getUserFriendlyErrorMessage('ECONNREFUSED')).toBe(
      "Couldn't connect. Check your internet connection."
    );
  });

  it('maps authentication/session failures', () => {
    expect(getUserFriendlyErrorMessage(new Error('401 Unauthorized'))).toBe(
      'Session expired. Please sign in again.'
    );
    expect(getUserFriendlyErrorMessage('Not authenticated')).toBe(
      'Session expired. Please sign in again.'
    );
  });

  it('falls back to generic error for unknown failures', () => {
    expect(getUserFriendlyErrorMessage(new Error('Unexpected server blowup'))).toBe(
      'Something went wrong. Please try again.'
    );
  });
});
