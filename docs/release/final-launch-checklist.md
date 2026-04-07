# Final Launch Checklist (Play Store)

Last Updated: April 6, 2026

## Build and Signing
- [ ] `eas build --platform android --profile production` succeeds.
- [ ] Play App Signing enabled in Play Console.
- [ ] Upload key is backed up securely.
- [ ] `versionCode` auto-increment confirmed for each release.

## Android Compliance
- [ ] Target API policy met (`targetSdkVersion=36`, verify policy at submission time).
- [ ] All declared permissions are justified in store listing and in-app UX.
- [ ] Remove background location permissions unless core feature + declaration approved.
- [ ] Production API endpoint uses HTTPS only.

## Security
- [ ] Rotate all production secrets before launch.
- [ ] Verify no service-role keys in client bundle or logs.
- [ ] Restrict server CORS origins for production.
- [ ] Confirm rate limiting and abuse controls are active.

## Privacy and Legal
- [ ] Privacy Policy hosted on public URL.
- [ ] Terms of Service hosted on public URL.
- [ ] Account deletion URL hosted on public URL.
- [ ] Data Safety form matches actual runtime data flows.
- [ ] Support email/contact visible in Play listing.

## QA and Reliability
- [ ] Client tests pass in CI.
- [ ] Server tests pass with local test DB/Redis in CI.
- [ ] Manual regression done: auth, onboarding, feed, likes, matches, messaging, profile, notifications, account deletion.
- [ ] Failure-path testing done: offline mode, token expiry, server errors, retry behavior.

## Observability and Operations
- [ ] Error monitoring enabled (for example Sentry) for client and server.
- [ ] Structured logs retained with alerting for critical endpoints.
- [ ] Incident response and rollback plan documented.

## Store Listing and Assets
- [ ] Final short + long description approved.
- [ ] Screenshots and feature graphic uploaded.
- [ ] App category and content rating completed.
- [ ] Release notes included.
