# Troupe Data Disclosure Matrix (Play Data Safety + GDPR/CCPA)

Last Updated: April 6, 2026

## Data Categories

| Data Category | Examples | Collected | Shared | Purpose | Storage |
|---|---|---|---|---|---|
| Personal identifiers | Email, user IDs, Supabase auth IDs | Yes | Service providers only | Account creation, login, account security | Supabase Auth + Postgres |
| Profile info | Name, bio, skills, interests, projects, experiences, age/gender, GitHub username | Yes | Other users (visible profile fields), service providers | Profile display, matching relevance | Supabase Postgres |
| User content | Messages, intro/reply text | Yes | Matched users, service providers | Messaging and safety/moderation | Supabase Postgres |
| App interactions | Likes, matches, blocks, reports | Yes | Service providers | Matchmaking and trust/safety workflows | Supabase Postgres |
| Location (sensitive) | Latitude/longitude, derived city/country, sharing setting | Optional | Geocoding provider + service providers | Location-based profile context | Supabase Postgres; derived via geocoding API |
| Device/app diagnostics | App version, request metadata, IP, user-agent | Yes | Service providers | Security, abuse prevention, debugging | Server logs + audit records |
| Push notification data | Expo push token, match notification preferences | Optional | Expo push provider + service providers | Deliver notifications | Supabase Postgres |
| Uploaded media | Profile picture files and metadata | Optional | Service providers and users (as configured) | Profile identity/presentation | Supabase Storage |
| Rate-limit/security metadata | Rate-limit counters, nonce records, security event metadata | Yes | Service providers | Abuse prevention and replay/rate-limit protection | Redis + Postgres |

## Third-Party Services Used
- Supabase: authentication, database, storage, realtime.
- Expo services: push notification tokening/delivery and runtime support.
- Redis provider (for example Upstash): rate limiting and cache.
- OpenStreetMap/Nominatim: reverse geocoding coordinates to city/country.
- Google OAuth: optional sign-in provider.

## Data Handling Notes for Play Data Safety
- Encryption in transit: Yes (HTTPS/TLS endpoints).
- User can request account deletion: Yes (in-app delete flow + web URL for Play listing).
- Data selling: No.
- Sensitive data: precise location and user-generated content are collected when features are enabled/used.
- Minimum age policy exists in onboarding and legal docs (13+).
