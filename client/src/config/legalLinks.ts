/**
 * Public legal/account URLs used for Play Store disclosures.
 * Keep these on HTTPS and set them in EAS/environment configuration.
 */
const isDevRuntime =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

/**
 * NOTE: `process.env.EXPO_PUBLIC_*` must be read with a *static* member
 * expression. babel-preset-expo only inlines literal `process.env.EXPO_PUBLIC_X`
 * accesses; a dynamic `process.env[key]` lookup is left untouched and resolves to
 * undefined at runtime, which silently nulled every link here. Do not refactor
 * these reads behind a variable key.
 */
function parseHttpsUrl(envKey: string, rawValue: string | undefined): string | null {
  const raw = (rawValue ?? '').trim();
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
  privacyPolicy: parseHttpsUrl(
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
  ),
  termsOfService: parseHttpsUrl('EXPO_PUBLIC_TERMS_URL', process.env.EXPO_PUBLIC_TERMS_URL),
  accountDeletion: parseHttpsUrl(
    'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL
  ),
} as const;

