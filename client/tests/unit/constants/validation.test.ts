import { describe, it, expect } from 'vitest';
import {
  isMessageValid,
  isIntroMessageValid,
  getMessageError,
  getIntroMessageError,
  MESSAGE_MAX_LENGTH,
  INTRO_MESSAGE_MIN_LENGTH,
  INTRO_MESSAGE_MAX_LENGTH,
  REPLY_MESSAGE_MIN_LENGTH,
  REPLY_MESSAGE_MAX_LENGTH,
  PROFILE_TAG_REGEX,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  REPORT_REASON_MIN_LENGTH,
  REPORT_REASON_MAX_LENGTH,
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

  it('exposes reply message length constants for client use', () => {
    expect(REPLY_MESSAGE_MIN_LENGTH).toBe(1);
    expect(REPLY_MESSAGE_MAX_LENGTH).toBe(500);
  });

  it('PROFILE_TAG_REGEX accepts valid skill/interest tags', () => {
    expect(PROFILE_TAG_REGEX.test('React')).toBe(true);
    expect(PROFILE_TAG_REGEX.test('C++')).toBe(true);
    expect(PROFILE_TAG_REGEX.test('Open Source')).toBe(true);
    expect(PROFILE_TAG_REGEX.test('Node.js')).toBe(true);
    expect(PROFILE_TAG_REGEX.test('AI/ML')).toBe(true);
    expect(PROFILE_TAG_REGEX.test('Startups')).toBe(true);
  });

  it('PROFILE_TAG_REGEX rejects invalid tags', () => {
    expect(PROFILE_TAG_REGEX.test('')).toBe(false);
    expect(PROFILE_TAG_REGEX.test(' ')).toBe(false);
    expect(PROFILE_TAG_REGEX.test('<script>')).toBe(false);
    expect(PROFILE_TAG_REGEX.test(' leading')).toBe(false);
  });

  it('exposes profile and report limits for client validation', () => {
    expect(PROFILE_TAG_MAX_LENGTH).toBe(30);
    expect(PROFILE_BIO_MAX_LENGTH).toBe(300);
    expect(REPORT_REASON_MIN_LENGTH).toBe(10);
    expect(REPORT_REASON_MAX_LENGTH).toBe(500);
  });
});
