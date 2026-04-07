/**
 * Public legal/account URLs used for Play Store disclosures.
 * Keep these on HTTPS and set them in EAS/environment configuration.
 */
const isDevRuntime =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function readHttpsEnv(envKey: string): string | null {
  const raw = (process.env[envKey] ?? '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      throw new Error('must use https');
    }
    return parsed.toString();
  } catch {
    if (isDevRuntime) {
      console.warn(`[legal-links] Ignoring invalid ${envKey}: "${raw}"`);
    }
    return null;
  }
}

export const LEGAL_LINKS = {
  privacyPolicy: readHttpsEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL'),
  termsOfService: readHttpsEnv('EXPO_PUBLIC_TERMS_URL'),
  accountDeletion: readHttpsEnv('EXPO_PUBLIC_ACCOUNT_DELETION_URL'),
} as const;

