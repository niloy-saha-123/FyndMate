/**
 * @file client/src/hooks/useLocation.ts
 * @description Hook for managing user location updates and privacy preferences.
 * 
 * This hook handles:
 * - Requesting OS location permission
 * - Getting GPS coordinates
 * - Sending location updates to the server
 * - Managing location sharing preferences (never/whileOpen/always)
 * - Debouncing updates to save battery and API quota
 */

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, getApiBaseUrl } from '../lib/apiClient';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────────────────────────────
// SECURE STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────
const LOCATION_SECRET_KEY = 'fyndmate_location_secret';
const LOCATION_SHARING_KEY = 'locationSharing';
const LOCATION_PERMISSION_KEY = 'locationPermission';
const LOCATION_PERMISSION_PROMPTED_KEY = 'locationPermissionPrompted';
const LOCATION_LAST_UPDATE_KEY = 'lastLocation';
const LOCATION_LAST_LABEL_KEY = 'locationLastLabel';
const LOCATION_UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const LOCATION_BACKGROUND_TASK = 'fyndmate-background-location';

// ─────────────────────────────────────────────────────────────────────
// HMAC-SHA256 Implementation using crypto-js
// ─────────────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 signature using crypto-js
 * This matches the server's crypto.createHmac('sha256', secret).update(data).digest('hex')
 */
function computeHmacSha256(data: string, key: string): string {
    const hash = CryptoJS.HmacSHA256(data, key);
    return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Get the location secret from secure storage.
 * The secret is fetched from the server on first use and stored securely.
 */
async function getLocationSecret(): Promise<string | null> {
    try {
        // Try to get from secure storage first
        let secret = await SecureStore.getItemAsync(LOCATION_SECRET_KEY);
        
        if (!secret) {
            console.log('📍 Fetching location secret from server...');
            try {
                // Fetch from server (endpoint returns user's locationSecret)
                const response = await apiClient.get<{ locationSecret: string }>('/api/users/me/location-secret');
                secret = response.locationSecret;
                if (!secret) {
                    console.error('📍 Server returned empty locationSecret — check server sanitizer configuration');
                    return null;
                }
            } catch (apiError: any) {
                // Surface rate-limit errors clearly instead of a generic re-auth message
                if (apiError?.status === 429 || apiError?.message?.includes('429')) {
                    console.warn('📍 Location secret rate-limited. Will retry later.');
                    return null;
                }
                console.error('📍 Failed to fetch location secret from API:', apiError?.message || apiError);
                return null;
            }
            
            if (secret) {
                // Store securely for future use
                await SecureStore.setItemAsync(LOCATION_SECRET_KEY, secret);
                console.log('📍 Location secret saved to secure storage');
            }
        }
        
        return secret;
    } catch (error) {
        console.error('❌ Failed to get location secret:', error);
        return null;
    }
}

async function generateLocationSignature(payload: {
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    nonce: string;
}): Promise<string> {
    const secret = await getLocationSecret();
    if (!secret) {
        throw new Error('Location update temporarily unavailable. Please try again in a few minutes.');
    }

    const { userId, latitude, longitude, timestamp, nonce } = payload;
    const data = `${userId}|${latitude}|${longitude}|${timestamp}|${nonce}`;
    const signature = computeHmacSha256(data, secret);

    return signature;
}

/**
 * Clear the location secret from secure storage.
 * Call this on logout to ensure clean state.
 */
export async function clearLocationSecret(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(LOCATION_SECRET_KEY);
        console.log('📍 Location secret cleared');
    } catch (error) {
        console.error('Failed to clear location secret:', error);
    }
}

// ─────────────────────────────────────────────────────────────────────
// LOCATION SHARING OPTIONS (for UI Developer)
// ─────────────────────────────────────────────────────────────────────
// 
// SIMPLIFIED UX: Just an ON/OFF toggle
// 
// What user sees in Settings:
// ┌────────────────────────────────────────┐
// │ Location                                │
// │ ────────────────────────────────────    │
// │ Share your location                     │
// │                                         │
// │ ○ OFF                                   │
// │ ● ON                                    │
// │                                         │
// │ Permission: While Using App ✓           │
// │ Current Location: San Francisco, USA    │
// │ Last updated: 2 hours ago              │
// │                                         │
// │ [Update Location Now]                  │
// └────────────────────────────────────────┘
// 
// How it works:
// 1. First time: OS asks "Allow location?"
//    - User chooses: "Always" or "While Using App" or "Don't Allow"
//    - We detect and save what they chose
// 
// 2. In app: Simple ON/OFF toggle
//    - ON: Use whatever permission OS granted (Always or While Using)
//    - OFF: Stop updating location (doesn't revoke OS permission)
// 
// 3. Background updates:
//    - If OS permission = "Always" → Register background task
//    - If OS permission = "While Using" → Only update when app open
//    - If OS permission = "Denied" → Show error message
// 
// To change "Always" ↔ "While Using":
// User must go to: iPhone Settings → FyndMate → Location
// 
// See: LocationSettingsScreen.tsx for the UI implementation
// ─────────────────────────────────────────────────────────────────────

type LocationSharing = 'on' | 'off';  // Simple toggle
type LocationPermission = 'always' | 'whileUsing' | 'denied';  // What OS granted

interface LastLocation {
    latitude: number;
    longitude: number;
    timestamp: number;
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function shouldUpdateLocationByCoords(
    latitude: number,
    longitude: number
): Promise<boolean> {
    try {
        const lastLocationStr = await AsyncStorage.getItem(LOCATION_LAST_UPDATE_KEY);
        if (!lastLocationStr) return true;

        const lastLocation: LastLocation = JSON.parse(lastLocationStr);
        const now = Date.now();
        const hoursSinceUpdate = (now - lastLocation.timestamp) / (1000 * 60 * 60);

        if (hoursSinceUpdate < 1) return false;
        if (hoursSinceUpdate > 24) return true;

        const distance = calculateDistance(
            lastLocation.latitude,
            lastLocation.longitude,
            latitude,
            longitude
        );
        return distance > 50;
    } catch (error) {
        console.error('Error checking location update debounce:', error);
        return true;
    }
}

async function postSignedLocationUpdate(payload: {
    userId: string;
    latitude: number;
    longitude: number;
    locationSharing: LocationSharing;
    locationPermission: LocationPermission;
    authToken: string;
}): Promise<{ city?: string; country?: string } | null> {
    const timestamp = new Date().toISOString();
    const nonce = Crypto.randomUUID();
    const signature = await generateLocationSignature({
        userId: payload.userId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp,
        nonce,
    });

    const response = await fetch(`${getApiBaseUrl()}/api/users/me/location`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.authToken}`,
        },
        body: JSON.stringify({
            latitude: payload.latitude,
            longitude: payload.longitude,
            timestamp,
            nonce,
            signature,
            locationSharing: payload.locationSharing,
            locationPermission: payload.locationPermission,
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Location update failed with status ${response.status}`);
    }

    const json = (await response.json().catch(() => null)) as
        | { city?: string; country?: string }
        | null;
    return json;
}

async function syncLocationFromCoordinates(payload: {
    latitude: number;
    longitude: number;
    locationSharing: LocationSharing;
    locationPermission: LocationPermission;
    allowDebounce: boolean;
    throwOnError?: boolean;
}): Promise<{ city?: string; country?: string } | null> {
    const pref = payload.locationSharing;
    if (pref !== 'on') return null;

    if (payload.allowDebounce) {
        const shouldUpdate = await shouldUpdateLocationByCoords(payload.latitude, payload.longitude);
        if (!shouldUpdate) return null;
    }

    const sessionRes = await supabase.auth.getSession();
    const accessToken = sessionRes.data.session?.access_token;
    const userId = sessionRes.data.session?.user?.id;

    if (!accessToken || !userId) {
        if (payload.throwOnError) {
            throw new Error('Missing auth session for location update.');
        }
        return null;
    }

    const response = await postSignedLocationUpdate({
        userId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        locationSharing: pref,
        locationPermission: payload.locationPermission,
        authToken: accessToken,
    });

    await AsyncStorage.setItem(
        LOCATION_LAST_UPDATE_KEY,
        JSON.stringify({
            latitude: payload.latitude,
            longitude: payload.longitude,
            timestamp: Date.now(),
        })
    );

    const label = response?.city && response?.country ? `${response.city}, ${response.country}` : '';
    if (label) {
        await AsyncStorage.setItem(LOCATION_LAST_LABEL_KEY, label);
    }
    return response;
}

if (!TaskManager.isTaskDefined(LOCATION_BACKGROUND_TASK)) {
    TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }: { data?: unknown; error?: unknown }) => {
        if (error) {
            console.error('Background location task error:', error);
            return;
        }

        const preference = (await AsyncStorage.getItem(LOCATION_SHARING_KEY)) as LocationSharing | null;
        if (preference !== 'on') {
            return;
        }

        const { locations } = (data as { locations?: Location.LocationObject[] }) ?? {};
        const latest = locations?.[locations.length - 1];
        if (!latest) {
            return;
        }

        try {
            await syncLocationFromCoordinates({
                latitude: latest.coords.latitude,
                longitude: latest.coords.longitude,
                locationSharing: 'on',
                locationPermission: 'always',
                allowDebounce: true,
            });
        } catch (taskError) {
            console.error('Background location sync failed:', taskError);
        }
    });
}

export function useLocation() {
    const [preference, setPreference] = useState<LocationSharing>('off');
    const [permission, setPermission] = useState<LocationPermission | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Get current user from auth context
    const { user, profile } = useAuth();

    // Note: preference/permission loading is handled in the initialization effect at the bottom

    // ─────────────────────────────────────────────────────────────────────
    // Request OS location permission
    // ─────────────────────────────────────────────────────────────────────
    async function getPermissionLevel(): Promise<LocationPermission> {
        const foreground = await Location.getForegroundPermissionsAsync();
        if (!foreground.granted) return 'denied';

        const background = await Location.getBackgroundPermissionsAsync();
        return background.granted ? 'always' : 'whileUsing';
    }

    function getPromptedKey(userId: string): string {
        return `${LOCATION_PERMISSION_PROMPTED_KEY}:${userId}`;
    }

    async function requestPermission(): Promise<boolean> {
        try {
            const existing = await Location.getForegroundPermissionsAsync();
            if (existing.granted) {
                const level = await getPermissionLevel();
                setPermission(level);
                await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, level);
                return true;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermission('denied');
                await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, 'denied');
                return false;
            }

            const level = await getPermissionLevel();
            setPermission(level);
            await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, level);
            return true;
        } catch (error) {
            console.error('Error requesting permission:', error);
            return false;
        }
    }

    async function registerBackgroundUpdates() {
        const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
        if (alreadyStarted) return;

        await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_UPDATE_INTERVAL_MS,
            distanceInterval: 1000,
            showsBackgroundLocationIndicator: true,
            pausesUpdatesAutomatically: true,
            foregroundService: {
                notificationTitle: 'FyndMate location',
                notificationBody: 'Updating your city and country in the background',
            },
        });
    }

    async function unregisterBackgroundUpdates() {
        const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
        if (!started) return;
        await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
    }

    async function syncBackgroundUpdatesForState(
        pref: LocationSharing,
        permissionLevel: LocationPermission | null
    ) {
        if (pref === 'on' && permissionLevel === 'always') {
            try {
                await registerBackgroundUpdates();
            } catch (error) {
                console.error('Failed to register background location updates:', error);
            }
            return;
        }

        try {
            await unregisterBackgroundUpdates();
        } catch (error) {
            console.error('Failed to stop background location updates:', error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Update location now (main function)
    // ─────────────────────────────────────────────────────────────────────
    async function updateLocationNow() {
        if (preference === 'off') {
            Alert.alert(
                'Location Disabled',
                'Enable location sharing in Settings to update your location.'
            );
            return;
        }

        setLoading(true);
        try {
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            const backgroundPerm = await Location.getBackgroundPermissionsAsync();
            const osPermission: LocationPermission = backgroundPerm.granted
                ? 'always'
                : 'whileUsing';

            await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, osPermission);
            setPermission(osPermission);

            if (!user?.id || preference !== 'on') {
                throw new Error('User not authenticated. Please log in again.');
            }

            const response = await syncLocationFromCoordinates({
                latitude,
                longitude,
                locationSharing: preference,
                locationPermission: osPermission,
                allowDebounce: true,
                throwOnError: true,
            });

            if (response?.city && response.country) {
                setCurrentLocation(`${response.city}, ${response.country}`);
            }
            setLastUpdated(new Date());
        } catch (error: any) {
            console.error('Error updating location:', error);
            Alert.alert('Error', error.message || 'Failed to update location. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Change location sharing preference
    // ─────────────────────────────────────────────────────────────────────
    async function changePreference(newPref: LocationSharing) {
        await AsyncStorage.setItem(LOCATION_SHARING_KEY, newPref);
        setPreference(newPref);

        if (newPref === 'on') {
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                await AsyncStorage.setItem(LOCATION_SHARING_KEY, 'off');
                setPreference('off');
                await syncBackgroundUpdatesForState('off', permission);
                return;
            }

            let effectivePermission = await getPermissionLevel();

            try {
                const bg = await Location.getBackgroundPermissionsAsync();
                if (!bg.granted) {
                    const req = await Location.requestBackgroundPermissionsAsync();
                    if (req.granted) {
                        effectivePermission = 'always';
                    }
                }
            } catch (error) {
                console.log('Background permission request skipped:', error);
            }

            setPermission(effectivePermission);
            await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, effectivePermission);
            await syncBackgroundUpdatesForState('on', effectivePermission);
            await updateLocationNow();
        } else {
            setCurrentLocation(null);
            setLastUpdated(null);
            await syncBackgroundUpdatesForState('off', permission);

            try {
                await apiClient.patch('/api/users/me/location-settings', {
                    locationSharing: 'off',
                });
            } catch (error) {
                console.error('Failed to update location sharing preference:', error);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Auto-update location on app launch (one-time check)
    // ─────────────────────────────────────────────────────────────────────
    // 
    // This effect runs ONLY ONCE when the app opens (empty dependency array).
    // 
    // Why not re-run when preference changes?
    // - The changePreference() function already handles location updates
    // - Re-running on every preference change would waste battery
    // - Users toggling settings shouldn't trigger GPS calls
    // 
    // When does location update?
    // 1. On app launch (this effect) - if preference allows
    // 2. When user changes preference to "whileOpen" or "always" (changePreference)
    // 3. When user manually taps "Update Location Now" button (updateLocationNow)
    // 
    const [initialized, setInitialized] = useState(false);
    
    // Keep display in sync with profile cache
    useEffect(() => {
        if (profile?.city && profile?.country && profile.locationSharing === 'on') {
            setCurrentLocation(`${profile.city}, ${profile.country}`);
        } else if (profile?.locationSharing === 'off') {
            setCurrentLocation(null);
        }
    }, [profile?.city, profile?.country, profile?.locationSharing]);

    // Load saved preference first, prompt once, then auto-update if enabled
    useEffect(() => {
        async function initLocation() {
            if (!user?.id) {
                await unregisterBackgroundUpdates().catch(() => {});
                setInitialized(true);
                return;
            }

            // Load saved preference from storage
            const savedPref = await AsyncStorage.getItem(LOCATION_SHARING_KEY);
            const savedPerm = await AsyncStorage.getItem(LOCATION_PERMISSION_KEY);
            const promptedKey = getPromptedKey(user.id);
            const hasPrompted = await AsyncStorage.getItem(promptedKey);
            
            const serverPref = profile?.locationSharing === 'on' || profile?.locationSharing === 'off'
                ? (profile.locationSharing as LocationSharing)
                : null;
            const serverPerm = profile?.locationPermission === 'always'
                || profile?.locationPermission === 'whileUsing'
                || profile?.locationPermission === 'denied'
                ? (profile.locationPermission as LocationPermission)
                : null;
            let effectivePref = (savedPref as LocationSharing | null) ?? serverPref ?? 'off';
            setPreference(effectivePref);
            await AsyncStorage.setItem(LOCATION_SHARING_KEY, effectivePref);

            let effectivePermission: LocationPermission;
            if (savedPerm) {
                effectivePermission = savedPerm as LocationPermission;
            } else if (serverPerm) {
                effectivePermission = serverPerm;
                await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, serverPerm);
            } else {
                const detected = await getPermissionLevel();
                effectivePermission = detected;
                await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, detected);
            }
            setPermission(effectivePermission);

            const lastLabel = await AsyncStorage.getItem(LOCATION_LAST_LABEL_KEY);
            if (effectivePref === 'on' && lastLabel) {
                setCurrentLocation(lastLabel);
            }
            const lastLocationStr = await AsyncStorage.getItem(LOCATION_LAST_UPDATE_KEY);
            if (lastLocationStr) {
                try {
                    const parsed = JSON.parse(lastLocationStr) as LastLocation;
                    if (parsed?.timestamp) {
                        setLastUpdated(new Date(parsed.timestamp));
                    }
                } catch {
                    // no-op
                }
            }

            // Ask once on first app start for this user (when they're in the app).
            if (!hasPrompted) {
                const foreground = await Location.getForegroundPermissionsAsync();
                if (foreground.status === 'undetermined') {
                    // In-app prompt first so the user knows why we're asking
                    const userWantsToAllow = await new Promise<boolean>((resolve) => {
                        Alert.alert(
                            'Use your location?',
                            'FyndMate uses your location to show your city and country on your profile. You can change this anytime in Settings.',
                            [
                                { text: 'Not Now', onPress: () => resolve(false), style: 'cancel' },
                                { text: 'Allow', onPress: () => resolve(true) },
                            ]
                        );
                    });
                    if (userWantsToAllow) {
                        const requested = await Location.requestForegroundPermissionsAsync();
                        if (requested.granted) {
                            const level = await getPermissionLevel();
                            effectivePermission = level;
                            setPermission(level);
                            await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, level);
                        } else {
                            effectivePermission = 'denied';
                            setPermission('denied');
                            await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, 'denied');
                        }
                    } else {
                        effectivePermission = 'denied';
                        setPermission('denied');
                        await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, 'denied');
                    }
                }
                await AsyncStorage.setItem(promptedKey, '1');
            }

            if (effectivePermission === 'denied' && effectivePref === 'on') {
                effectivePref = 'off';
                setPreference('off');
                await AsyncStorage.setItem(LOCATION_SHARING_KEY, 'off');
                setCurrentLocation(null);
                setLastUpdated(null);
                apiClient.patch('/api/users/me/location-settings', {
                    locationSharing: 'off',
                }).catch((error) => {
                    console.error('Failed to sync denied permission state to server:', error);
                });
            }

            await syncBackgroundUpdatesForState(effectivePref, effectivePermission);
            setInitialized(true);
            
            // Auto-update on app launch if preference is 'on'
            if (effectivePref === 'on') {
                console.log('📍 Auto-updating location on app launch...');
                // Small delay to ensure everything is ready
                setTimeout(() => {
                    updateLocationNow();
                }, 500);
            }
        }
        
        initLocation();
    }, [profile?.locationSharing, profile?.locationPermission, user?.id]); // Re-run on auth/profile availability

    useEffect(() => {
        if (!initialized) return;
        syncBackgroundUpdatesForState(preference, permission).catch((error) => {
            console.error('Failed to synchronize background location state:', error);
        });
    }, [initialized, preference, permission]);

    // Foreground periodic update when sharing is ON.
    useEffect(() => {
        if (!initialized || !user?.id || preference !== 'on') return;
        const intervalId = setInterval(() => {
            updateLocationNow().catch((error) => {
                console.error('Periodic location update failed:', error);
            });
        }, LOCATION_UPDATE_INTERVAL_MS);

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                updateLocationNow().catch((error) => {
                    console.error('Foreground resume location update failed:', error);
                });
            }
        });

        return () => {
            clearInterval(intervalId);
            appStateSub.remove();
        };
    }, [initialized, preference, user?.id]);

    return {
        preference,
        permission,
        loading,
        currentLocation,
        lastUpdated,
        updateLocationNow,
        changePreference,
        initialized,
    };
};
