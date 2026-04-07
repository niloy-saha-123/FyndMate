/**
 * @file src/lib/env.ts
 * @description Shared environment validation helpers used by runtime modules.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2', '::1']);

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function assertProductionRequired(name: string, value: string | undefined) {
  if (!isProductionRuntime()) return;
  if (value && value.trim().length > 0) return;
  throw new Error(`${name} environment variable is required in production`);
}

export function assertProductionNonLocalUrl(name: string, value: string | undefined) {
  if (!isProductionRuntime() || !value) return;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL in production`);
  }

  if (LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${name} cannot target local host "${parsed.hostname}" in production`);
  }
}
