/**
 * @file src/utils/sanitizeText.ts
 * @description Minimal text sanitizer for MVP. Strips HTML tags and control chars.
 *
 * NOTE: This is not a full HTML sanitizer. We intentionally enforce "text-only"
 * for user-generated content in mobile MVP. Web clients should use robust
 * HTML sanitization and output encoding.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_TAGS = /<[^>]*>/g;

export function sanitizeText(input: string): string {
  return input
    .replace(HTML_TAGS, '')
    .replace(CONTROL_CHARS, '')
    .trim();
}
