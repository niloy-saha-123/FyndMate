# Pre-Launch QA Test Plan

Last Updated: April 6, 2026

## Unit Tests (High Priority)

1. Auth callback parser
- Validate hash token extraction (`#access_token=`).
- Validate query token extraction (`?access_token=`).
- Validate malformed callback returns safe error without token logs.

2. API client error mapping
- Verify `401` triggers unauthorized handler and session reset.
- Verify `429` and validation errors map to user-safe messages.
- Verify empty-body `204` responses do not crash JSON parsing.

3. Location signing and replay protections
- Reject location update when timestamp skew exceeds allowed window.
- Reject update when nonce is reused.
- Reject update with invalid signature.

4. Notification token handling
- Ensure token masking in logs.
- Ensure token save/clear routes are called with auth headers.
- Ensure opt-out disables token server-side.

5. Profile sanitization
- Verify HTML/script tags are sanitized from bio/projects/experience.
- Verify max lengths and required fields are enforced.

## Integration / API Tests (High Priority)

1. Auth and onboarding
- Signup/login/OAuth callback creates account once.
- App gate routes correctly when token/session expires.
- Account deletion removes access and blocks re-use with stale token.

2. Feed, likes, matches
- Like/pass transitions, duplicate prevention, and idempotency.
- Match creation exactly once under concurrency.
- Unmatch and rematch message visibility boundary.

3. Messaging and notifications
- Send/edit/delete message authorization checks.
- Push notification preference by match.
- Push dispatch only for active matches and valid recipients.

4. Location privacy
- `/api/users/me/location` updates do not leak raw coordinates in responses.
- Public profile includes only city/country when sharing is ON.
- Public profile hides location when sharing is OFF.

5. Upload pipeline
- Reject unsupported mime/extensions and over-size payloads.
- Confirm upload metadata write only for authenticated owner.
- Prevent path traversal and malicious filename injection.

## Edge Cases and Failure Simulations

1. Network instability
- Offline app launch.
- Retry on 5xx with exponential backoff and jitter.
- No infinite retry loops on auth failure.

2. Service degradation
- Redis unavailable: rate limiter fallback behavior and warning logs.
- Geocoding timeout: location update should fail gracefully.
- Supabase latency spikes: no UI freeze, user-visible fallback.

3. Concurrency
- Rapid swipe bursts from same account.
- Concurrent block + message send race.
- Duplicate push token updates from two devices.

4. Time and data anomalies
- Future birthdate handling.
- Leap-day age computations.
- Clock skew between client and server for signed requests.

## Release-Blocking Acceptance Criteria

- Client tests pass with zero unhandled errors.
- Server unit and integration tests pass against ephemeral Postgres + Redis in CI.
- Typecheck passes for both client and server.
- No High/Critical production dependency vulnerabilities.
- Manual regression pass for auth, onboarding, feed, likes, matches, messaging, profile, notifications, delete account.
