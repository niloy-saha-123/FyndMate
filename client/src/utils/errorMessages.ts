/**
 * @file client/src/utils/errorMessages.ts
 * @description Maps technical errors to user-friendly messages for better UX.
 */

const NETWORK_PATTERNS = [
  /network/i,
  /fetch/i,
  /failed to fetch/i,
  /network request failed/i,
  /connection/i,
  /timeout/i,
  /econnrefused/i,
  /enotfound/i,
];

const SESSION_PATTERNS = [
  /session expired/i,
  /not authenticated/i,
  /401/i,
  /unauthorized/i,
];

/**
 * Converts technical error messages to user-friendly ones.
 * Use for fetch/load failures (feed, likes, etc.).
 */
export function getUserFriendlyErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (NETWORK_PATTERNS.some((p) => p.test(lower))) {
    return "Couldn't connect. Check your internet connection.";
  }

  if (SESSION_PATTERNS.some((p) => p.test(lower))) {
    return "Session expired. Please sign in again.";
  }

  return "Something went wrong. Please try again.";
}
