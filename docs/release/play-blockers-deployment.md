# Play Store Must-Fix Deployment Steps

Last Updated: April 6, 2026

## 1) Host legal pages and account deletion page on HTTPS (Vercel)

Upload these files from this repo into your website repo under `public/legal/`:
- `docs/legal/privacy-policy.html` -> `public/legal/privacy-policy`
- `docs/legal/terms-of-service.html` -> `public/legal/terms-of-service`
- `docs/legal/account-deletion.html` -> `public/legal/account-deletion`

If your framework requires `.html`, keep that extension and use those exact URLs in Play Console.

Expected public URLs after deploy:
- `https://<your-domain>/legal/privacy-policy`
- `https://<your-domain>/legal/terms-of-service`
- `https://<your-domain>/legal/account-deletion`

## 2) Wire URLs into mobile app build env

Set these env vars for production build (`eas secret` / EAS env / CI):
- `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<your-domain>/legal/privacy-policy`
- `EXPO_PUBLIC_TERMS_URL=https://<your-domain>/legal/terms-of-service`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL=https://<your-domain>/legal/account-deletion`

Local template exists at `client/.env.example`.

## 3) Permissions alignment for Play review

Changes already applied in code:
- Removed unneeded Android permissions from main manifest:
  - `android.permission.RECORD_AUDIO`
  - `android.permission.SYSTEM_ALERT_WINDOW`
  - `android.permission.WRITE_EXTERNAL_STORAGE`
- Kept required permissions for current features:
  - location (optional feature)
  - internet
  - vibrate
  - read external storage (profile image picker support on older Android versions)

## 4) Data Safety form submission

Use `docs/release/play-data-safety.json` as your source-of-truth when filling Play Console Data Safety questions.

## 5) Play Console fields to update

In Play Console (`Policy > App content`):
1. Privacy policy URL: `https://<your-domain>/legal/privacy-policy`
2. Account deletion URL: `https://<your-domain>/legal/account-deletion`
3. Data Safety: complete using `docs/release/play-data-safety.json`

## 6) Target SDK evidence

Verified from Gradle app properties:
- `compileSdkVersion: 36`
- `targetSdkVersion: 36`
- `minSdkVersion: 24`

This satisfies current Play target API requirement (35+).
