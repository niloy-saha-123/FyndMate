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
 * - If `EXPO_PUBLIC_API_URL` is provided use it.
 * - Otherwise default to localhost but when running in the
 *   simulator/emulator replace `localhost` with the proper host
 *   so device/emulator can reach the dev server.
 */
const DEFAULT_LOCAL = 'http://localhost:3000';
let API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_LOCAL;

if (__DEV__) {
  try {
    // If the URL targets localhost, try to find a host reachable from device/emulator
    if (API_BASE_URL.includes('localhost')) {
      // Expo provides debuggerHost (e.g. '192.168.1.10:19000') in Constants
      const dbgHost: string | undefined = (Constants.manifest && (Constants.manifest as any).debuggerHost) || (Constants.manifest2 && (Constants.manifest2 as any).debuggerHost);
      let hostIp: string | null = null;

      if (dbgHost) {
        hostIp = dbgHost.split(':')[0];
      }

      if (!hostIp) {
        // Android emulator default host mapping
        hostIp = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
      }

      API_BASE_URL = API_BASE_URL.replace('localhost', hostIp);
    }
  } catch (e) {
    // Non-fatal - keep original URL if anything goes wrong
    console.warn('apiClient: failed to auto-resolve localhost for emulator, using default', e);
  }
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let handleUnauthorized: UnauthorizedHandler = () => {};

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
function buildHeaders(requireAuth = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

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
 * Handle response, checking for 401 unauthorized.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Token expired or invalid - trigger logout flow
    handleUnauthorized();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  // Handle empty responses (204 No Content, etc.)
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
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(requireAuth),
    });
    return handleResponse<T>(response);
  },

  /**
   * POST request
   * @param endpoint API endpoint
   * @param body Request body (will be JSON stringified)
   * @param requireAuth Whether to require authentication (default: true)
   */
  async post<T = any>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(requireAuth),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  /**
   * PATCH request
   * @param endpoint API endpoint
   * @param body Request body (will be JSON stringified)
   * @param requireAuth Whether to require authentication (default: true)
   */
  async patch<T = any>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders(requireAuth),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  /**
   * DELETE request
   * @param endpoint API endpoint
   * @param requireAuth Whether to require authentication (default: true)
   */
  async delete<T = any>(endpoint: string, requireAuth = true): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(requireAuth),
    });
    return handleResponse<T>(response);
  },
};

export default apiClient;
