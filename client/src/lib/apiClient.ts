/**
 * @file client/src/lib/apiClient.ts
 * @description Centralized API client that automatically attaches auth headers.
 * 
 * RULES:
 * - ALL authenticated API calls MUST go through this client
 * - Token is sourced from Supabase session (via getter function)
 * - 401 responses trigger automatic logout via callback
 * - No screen/hook should manually set Authorization headers
 * 
 * USAGE:
 * 1. Initialize once in app root: initApiClient(getToken, onUnauthorized)
 * 2. Use apiClient.get(), apiClient.post(), etc. everywhere
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * API base URL resolution
 * - Production requires an explicit EXPO_PUBLIC_API_URL.
 * - Development can fall back to localhost for local API work.
 */
const DEFAULT_LOCAL = 'http://localhost:3000';
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);
const isDevRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function normalizeApiBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

  if (!configured) {
    if (isDevRuntime) return DEFAULT_LOCAL;
    throw new Error(
      'EXPO_PUBLIC_API_URL must be set for production builds. Refusing to fall back to localhost.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL is invalid: "${configured}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use http or https');
  }

  if (!isDevRuntime && LOCAL_DEV_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `EXPO_PUBLIC_API_URL cannot point to local host "${parsed.hostname}" in production`
    );
  }

  return normalizeApiBaseUrl(configured);
}

let API_BASE_URL = resolveApiBaseUrl();

/**
 * Get the development server host IP for device/emulator connectivity.
 * Expo SDK 49+ uses expoGoConfig/expoConfig instead of deprecated manifest.
 */
function getDevServerHost(): string | null {
  try {
    // Method 1: expoGoConfig.debuggerHost (Expo Go app)
    const expoGoHost = Constants.expoGoConfig?.debuggerHost;
    if (expoGoHost) {
      return expoGoHost.split(':')[0];
    }

    // Method 2: expoConfig.hostUri (dev builds, EAS updates)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      return hostUri.split(':')[0];
    }

    // Method 3: Legacy fallback for older SDKs (unlikely to work in SDK 54+)
    const legacyHost = (Constants as any).manifest?.debuggerHost ||
                       (Constants as any).manifest2?.debuggerHost; // TODO [POST-MVP]: Remove as any by properly typing manifest debuggerHost access.
    if (legacyHost) {
      return legacyHost.split(':')[0];
    }

    return null;
  } catch (e) {
    console.warn('apiClient: failed to detect dev server host', e);
    return null;
  }
}

if (isDevRuntime) {
  // If the URL targets localhost, try to find a host reachable from device/emulator
  if (API_BASE_URL.includes('localhost')) {
    const hostIp = getDevServerHost();

    if (hostIp) {
      API_BASE_URL = API_BASE_URL.replace('localhost', hostIp);
      console.log(`📡 API Client: Resolved localhost to ${hostIp}`);
    } else {
      // Fallback: Use platform-specific defaults
      // Android emulator: 10.0.2.2 maps to host machine
      // iOS simulator: 127.0.0.1 works (same as localhost)
      // Physical devices: This will fail - user must set EXPO_PUBLIC_API_URL
      const fallbackIp = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
      API_BASE_URL = API_BASE_URL.replace('localhost', fallbackIp);
      console.warn(
        `⚠️ API Client: Could not detect dev server host. Using fallback: ${fallbackIp}\n` +
        `If running on a physical device, set EXPO_PUBLIC_API_URL in your .env file to your machine's IP.`
      );
    }
  }
}

// Export for use by other services that need the resolved URL
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let handleUnauthorized: UnauthorizedHandler = () => {};
const API_METRICS_ENABLED = process.env.EXPO_PUBLIC_DEBUG_API_METRICS === '1';
const apiRequestCounters = new Map<string, number>();

function logApiMetric(
  method: string,
  endpoint: string,
  status: string | number,
  durationMs: number
) {
  if (!API_METRICS_ENABLED) return;
  const key = `${method} ${endpoint}`;
  const count = (apiRequestCounters.get(key) ?? 0) + 1;
  apiRequestCounters.set(key, count);
  console.log(
    `[api-metric] #${count} ${method} ${endpoint} status=${status} durationMs=${durationMs}`
  );
}

/**
 * Initialize the API client with auth functions.
 * Call this once at app startup (in _layout.tsx or App.tsx).
 * 
 * @param tokenGetter Function that returns the current access token
 * @param onUnauthorized Callback when 401 is received (should navigate to login)
 */
export function initApiClient(
  tokenGetter: TokenGetter,
  onUnauthorized: UnauthorizedHandler
) {
  getAccessToken = tokenGetter;
  handleUnauthorized = onUnauthorized;
}

/**
 * Build headers with Authorization if token exists.
 * Throws if token is missing (dev guard).
 */
function buildHeaders(requireAuth = true, includeJsonContentType = false): HeadersInit {
  const headers: HeadersInit = includeJsonContentType
    ? { 'Content-Type': 'application/json' }
    : {};

  const token = getAccessToken();

  if (requireAuth) {
    if (!token) {
      // Dev guard: crash fast with clear message
      if (__DEV__) {
        console.error(
          '🚨 API CLIENT ERROR: Attempted authenticated request without token.\n' +
          'Ensure user is logged in before making this request.'
        );
      }
      throw new Error('Not authenticated');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Structured API error for validation and other server errors.
 * Includes optional field for highlighting invalid form inputs.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle response, checking for 401 unauthorized.
 * Throws ApiError (with field when present) for 4xx/5xx so callers can highlight form inputs.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    const message = body.error || body.message || `HTTP ${response.status}`;
    const field = body.field;
    throw new ApiError(message, response.status, field);
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/**
 * API Client with automatic auth header injection.
 */
export const apiClient = {
  /**
   * GET request
   * @param endpoint API endpoint (e.g., '/api/feed')
   * @param requireAuth Whether to require authentication (default: true)
   */
  async get<T = any>(endpoint: string, requireAuth = true): Promise<T> {
    const startedAt = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    let status: string | number = 'ERR';
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(requireAuth, false),
    });
    status = response.status;
    try {
      return await handleResponse<T>(response);
    } finally {
      logApiMetric('GET', endpoint, status, Date.now() - startedAt);
    }
  },

  /**
   * POST request
   * @param endpoint API endpoint
   * @param body Request body (will be JSON stringified)
   * @param requireAuth Whether to require authentication (default: true)
   */
  async post<T = any>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    const startedAt = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    const hasBody = body !== undefined;
    let status: string | number = 'ERR';
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(requireAuth, hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    status = response.status;
    try {
      return await handleResponse<T>(response);
    } finally {
      logApiMetric('POST', endpoint, status, Date.now() - startedAt);
    }
  },

  /**
   * PUT request
   * @param endpoint API endpoint
   * @param body Request body (will be JSON stringified)
   * @param requireAuth Whether to require authentication (default: true)
   */
  async put<T = any>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    const startedAt = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    const hasBody = body !== undefined;
    let status: string | number = 'ERR';
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(requireAuth, hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    status = response.status;
    try {
      return await handleResponse<T>(response);
    } finally {
      logApiMetric('PUT', endpoint, status, Date.now() - startedAt);
    }
  },

  /**
   * PATCH request
   * @param endpoint API endpoint
   * @param body Request body (will be JSON stringified)
   * @param requireAuth Whether to require authentication (default: true)
   */
  async patch<T = any>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    const startedAt = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    const hasBody = body !== undefined;
    let status: string | number = 'ERR';
    const response = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders(requireAuth, hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    status = response.status;
    try {
      return await handleResponse<T>(response);
    } finally {
      logApiMetric('PATCH', endpoint, status, Date.now() - startedAt);
    }
  },

  /**
   * DELETE request
   * @param endpoint API endpoint
   * @param requireAuth Whether to require authentication (default: true)
   */
  async delete<T = any>(endpoint: string, requireAuth = true): Promise<T> {
    const startedAt = Date.now();
    const url = `${API_BASE_URL}${endpoint}`;
    let status: string | number = 'ERR';
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(requireAuth, false),
    });
    status = response.status;
    try {
      return await handleResponse<T>(response);
    } finally {
      logApiMetric('DELETE', endpoint, status, Date.now() - startedAt);
    }
  },
};

export default apiClient;
