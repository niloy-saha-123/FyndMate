/**
 * @file tests/unit/constants/validation.test.ts
 * @description Unit tests for shared validation constants and helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  isMessageValid,
  isIntroMessageValid,
  getMessageError,
  getIntroMessageError,
  MESSAGE_MAX_LENGTH,
  INTRO_MESSAGE_MIN_LENGTH,
  INTRO_MESSAGE_MAX_LENGTH,
} from '../../../src/constants/validation';

describe('validation constants helpers', () => {
  it('validates standard message boundaries', () => {
    expect(isMessageValid('hello')).toBe(true);
    expect(isMessageValid('   ')).toBe(false);
    expect(isMessageValid('x'.repeat(MESSAGE_MAX_LENGTH))).toBe(true);
    expect(isMessageValid('x'.repeat(MESSAGE_MAX_LENGTH + 1))).toBe(false);
  });

  it('validates intro message boundaries', () => {
    expect(isIntroMessageValid('x'.repeat(INTRO_MESSAGE_MIN_LENGTH))).toBe(true);
    expect(isIntroMessageValid('x'.repeat(INTRO_MESSAGE_MIN_LENGTH - 1))).toBe(false);
    expect(isIntroMessageValid('x'.repeat(INTRO_MESSAGE_MAX_LENGTH))).toBe(true);
    expect(isIntroMessageValid('x'.repeat(INTRO_MESSAGE_MAX_LENGTH + 1))).toBe(false);
  });

  it('returns specific message errors', () => {
    expect(getMessageError('')).toBe('Message cannot be empty');
    expect(getMessageError('x'.repeat(MESSAGE_MAX_LENGTH + 1))).toBe(
      `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`
    );
    expect(getMessageError('ok')).toBeNull();
  });

  it('returns specific intro message errors', () => {
    expect(getIntroMessageError('')).toBe(
      `Message must be at least ${INTRO_MESSAGE_MIN_LENGTH} characters`
    );
    expect(getIntroMessageError('short')).toContain('Message must be at least');
    expect(getIntroMessageError('x'.repeat(INTRO_MESSAGE_MAX_LENGTH + 1))).toBe(
      `Message cannot exceed ${INTRO_MESSAGE_MAX_LENGTH} characters`
    );
    expect(getIntroMessageError('x'.repeat(INTRO_MESSAGE_MIN_LENGTH))).toBeNull();
  });
});
