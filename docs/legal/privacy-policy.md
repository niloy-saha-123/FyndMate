# Troupe Privacy Policy

Last Updated: April 6, 2026

## 1. Who We Are
Troupe ("we", "our", "us") provides a mobile app for finding collaborators and messaging matched users.

Contact:
- Email: `infotroupe1@gmail.com`
- Mailing address: `58 Haynes Avenue, North York, Ontario M3J 0C1, Canada`

## 2. Data We Collect
We collect the following categories of data:

1. Account data: email, authentication identifiers, sign-in provider data (for example Google account basic profile fields when you choose Google Sign-In).
2. Profile data: name, bio, skills, interests, projects, experiences, age/birth date, gender, GitHub username, profile image, optional city/country visibility fields.
3. Interaction data: likes, matches, blocks, reports, message content and metadata (sender, recipient, timestamps, edit/delete state).
4. Location data: precise coordinates (when enabled), derived city/country, location sharing setting and permission level.
5. Device and technical data: push token, app version, device metadata, request metadata, IP address and user agent in operational/security logs.
6. Security and audit data: authentication events, rate-limit events, abuse/security checks, upload events and account deletion audit records.

## 3. Why We Process Data
We process personal data to:
- Provide core app functionality (auth, profile, feed, matching, messaging, notifications).
- Provide optional location-based features (city/country display).
- Prevent abuse and enforce Terms (rate limiting, moderation/reporting, security logging).
- Operate and improve reliability/performance (caching, debugging, monitoring).
- Meet legal obligations and support rights requests.

## 4. Legal Bases (GDPR)
For EEA/UK users, we rely on:
- Contract performance: providing the app features you request.
- Legitimate interests: fraud prevention, abuse prevention, service reliability.
- Consent: optional permissions (push notifications, device location permissions).
- Legal obligation: compliance, security and lawful requests.

## 5. Sharing and Third Parties
We share data with service providers required to operate the app:
- Supabase (Auth, PostgreSQL, Storage, Realtime)
- Expo services (push delivery and mobile runtime services)
- Upstash/Redis-compatible provider (rate limiting and caching)
- OpenStreetMap/Nominatim (reverse geocoding of coordinates)
- Google OAuth (when you choose Google Sign-In)

We do not sell personal data.

## 6. Storage, Retention, and Deletion
- Primary data is stored in Supabase Postgres and Supabase Storage.
- Cache/operational data may be stored in Redis.
- Some client-side cache data is stored on-device (AsyncStorage); location signing secret is stored in secure device storage.
- Account deletion removes core account access and data, with limited retention records kept for security/legal reasons.
- Upload and audit events are retained for fraud prevention and security investigations.

## 7. International Transfers
Your data may be processed in countries other than your own through our cloud/service providers. We use contractual and technical safeguards where required by law.

## 8. Security Measures
We use encryption in transit, authenticated APIs, token-based auth, server-side validation/sanitization, and access controls. No system is 100% secure.

## 9. Your Rights
Depending on your jurisdiction, you may have rights to:
- Access, correction, deletion
- Restriction or objection to processing
- Data portability
- Withdrawal of consent for optional processing

To exercise rights, contact: `infotroupe1@gmail.com`.

## 10. CCPA/CPRA Notice (US)
For California residents:
- Categories collected: identifiers, profile data, internet/network activity, geolocation data, in-app communications, and diagnostics/security logs.
- Business purposes: service delivery, security, analytics, support, and legal compliance.
- We do not sell personal information.
- You may request access/deletion/correction via `infotroupe1@gmail.com`.

## 11. Children
Troupe is not intended for children under 13. If we learn that we collected data from a child under 13, we will delete it.

## 12. Policy Updates
We may update this policy. Material changes will be reflected by updating the "Last Updated" date and, where required, giving additional notice.
