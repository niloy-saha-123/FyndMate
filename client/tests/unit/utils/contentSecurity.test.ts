import { describe, it, expect } from 'vitest';
import { isSuspiciousContent } from '../../../src/utils/contentSecurity';

describe('contentSecurity (client-side security)', () => {
  describe('isSuspiciousContent', () => {
    it('flags script tag patterns (XSS)', () => {
      expect(isSuspiciousContent('<script>alert(1)</script>')).toBe(true);
      expect(isSuspiciousContent('Hi <SCRIPT>evil</SCRIPT>')).toBe(true);
      expect(isSuspiciousContent('prefix <script src="x">')).toBe(true);
    });

    it('flags null byte in content', () => {
      expect(isSuspiciousContent('hello\u0000world')).toBe(true);
      expect(isSuspiciousContent('\u0000')).toBe(true);
    });

    it('flags SQL-like patterns with injection markers', () => {
      expect(isSuspiciousContent('SELECT * FROM users;')).toBe(true);
      expect(isSuspiciousContent('drop table users--')).toBe(true);
      expect(isSuspiciousContent('insert into x;')).toBe(true);
      expect(isSuspiciousContent('union select 1/*')).toBe(true);
      expect(isSuspiciousContent('; delete from messages')).toBe(true);
    });

    it('allows safe normal content', () => {
      expect(isSuspiciousContent('Hello, how are you?')).toBe(false);
      expect(isSuspiciousContent('I use JavaScript at work')).toBe(false);
      expect(isSuspiciousContent('SELECT is a word in English')).toBe(false);
      expect(isSuspiciousContent('No semicolons or comments here')).toBe(false);
    });

    it('allows empty string', () => {
      expect(isSuspiciousContent('')).toBe(false);
    });
  });
});
