import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertToLocalTime,
  formatRelativeTime,
  formatDateSection,
  isLastInBurst,
} from '../../../src/utils/timeFormatting';

describe('timeFormatting utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-12T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('convertToLocalTime returns Date from UTC string', () => {
    const date = convertToLocalTime('2026-02-12T11:58:00.000Z');
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2026-02-12T11:58:00.000Z');
  });

  it('formatRelativeTime handles short intervals', () => {
    expect(formatRelativeTime(new Date('2026-02-12T11:59:55.000Z'))).toBe('Just now');
    expect(formatRelativeTime(new Date('2026-02-12T11:59:30.000Z'))).toBe('30s ago');
    expect(formatRelativeTime(new Date('2026-02-12T11:55:00.000Z'))).toBe('5m ago');
    expect(formatRelativeTime(new Date('2026-02-12T10:00:00.000Z'))).toBe('2h ago');
  });

  it('formatRelativeTime handles day boundaries', () => {
    expect(formatRelativeTime(new Date('2026-02-11T12:00:00.000Z'))).toBe('Yesterday');
    expect(formatRelativeTime(new Date('2026-02-09T12:00:00.000Z'))).toBe('3d ago');
  });

  it('formatDateSection returns Today/Yesterday/date', () => {
    expect(formatDateSection(new Date('2026-02-12T08:00:00.000Z'))).toBe('Today');
    expect(formatDateSection(new Date('2026-02-11T08:00:00.000Z'))).toBe('Yesterday');
    const localeDate = new Date('2026-01-15T00:00:00.000Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    expect(formatDateSection(new Date('2026-01-15T00:00:00.000Z'))).toBe(localeDate);
  });

  it('isLastInBurst identifies burst boundaries correctly', () => {
    const messages = [
      { id: '1', senderId: 'A', createdAt: '2026-02-12T10:00:00.000Z' },
      { id: '2', senderId: 'A', createdAt: '2026-02-12T10:03:00.000Z' },
      { id: '3', senderId: 'A', createdAt: '2026-02-12T10:10:00.000Z' },
      { id: '4', senderId: 'B', createdAt: '2026-02-12T10:12:00.000Z' },
    ];

    expect(isLastInBurst(messages, 0)).toBe(false);
    expect(isLastInBurst(messages, 1)).toBe(true);
    expect(isLastInBurst(messages, 2)).toBe(true);
    expect(isLastInBurst(messages, 3)).toBe(true);
  });
});
