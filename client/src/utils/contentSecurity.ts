/**
 * @file client/src/utils/contentSecurity.ts
 * @description Client-side checks for suspicious user content (XSS, injection patterns).
 * Used to flag or block content before sending or displaying.
 */

/**
 * Detects content that may be XSS or injection attempts.
 * Use to show a warning or block sending (e.g. in chat).
 */
export function isSuspiciousContent(content: string): boolean {
  const lower = content.toLowerCase();
  if (lower.includes('<script')) return true;
  if (content.includes('\u0000')) return true;

  const sqlPattern = /\b(drop|alter|delete|insert|update|union|select)\b/i;
  const injectionMarkers = /(--|\/\*|\*\/|;)/;
  if (sqlPattern.test(content) && injectionMarkers.test(content)) return true;

  return false;
}
