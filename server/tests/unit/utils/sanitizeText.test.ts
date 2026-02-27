/**
 * @file tests/unit/utils/sanitizeText.test.ts
 * @description Unit tests for the sanitizeText utility function
 */

import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../../src/utils/sanitizeText.js';

describe('sanitizeText', () => {
    /**
     * Should strip <b> tags from text
     */
    it('strips <b>bold</b> to bold', () => {
        const result = sanitizeText('<b>bold</b>');
        expect(result).toBe('bold');
    });

    /**
     * Should strip nested HTML tags
     */
    it('strips nested <div><span>text</span></div> to text', () => {
        const result = sanitizeText('<div><span>text</span></div>');
        expect(result).toBe('text');
    });

    /**
     * Should strip script tags and their content
     */
    it('strips <script>alert(xss)</script>', () => {
        const result = sanitizeText("<script>alert('xss')</script>");
        expect(result).toBe("alert('xss')");
    });

    /**
     * Should strip control characters like null byte and tab
     */
    it('strips control chars (null byte, tab)', () => {
        const result = sanitizeText('hello\u0000world\u0009test');
        expect(result).toBe('helloworldtest');
    });

    /**
     * Should trim leading and trailing whitespace
     */
    it('trims whitespace', () => {
        const result = sanitizeText('   hello world   ');
        expect(result).toBe('hello world');
    });

    /**
     * Should return empty string for empty input
     */
    it('returns empty string for empty input', () => {
        const result = sanitizeText('');
        expect(result).toBe('');
    });

    /**
     * Should return empty string when only HTML tags present
     */
    it('returns empty string for HTML-only input', () => {
        const result = sanitizeText('<div></div><span></span>');
        expect(result).toBe('');
    });

    /**
     * Should preserve unicode and emoji characters
     */
    it('preserves unicode/emoji like 🎉 hello', () => {
        const result = sanitizeText('🎉 hello');
        expect(result).toBe('🎉 hello');
    });

    /**
     * Should handle mixed HTML, control chars, and whitespace
     */
    it('handles mixed HTML + control chars + whitespace', () => {
        const result = sanitizeText('  <b>hello</b>\u0000<script>bad</script>  world\u0009  ');
        expect(result).toBe('hellobad  world');
    });
});
