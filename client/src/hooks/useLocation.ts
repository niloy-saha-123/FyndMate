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

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../auth/AuthProvider';

// ─────────────────────────────────────────────────────────────────────
// SECURE STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────
const LOCATION_SECRET_KEY = 'fyndmate_location_secret';

// ─────────────────────────────────────────────────────────────────────
// HMAC-SHA256 Implementation for React Native
// ─────────────────────────────────────────────────────────────────────
// 
// Since expo-crypto doesn't have native HMAC support, we implement
// HMAC-SHA256 manually using the standard HMAC construction:
// HMAC(K, m) = H((K' ⊕ opad) || H((K' ⊕ ipad) || m))
// ─────────────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 signature
 * This matches the server's crypto.createHmac('sha256', secret).update(data).digest('hex')
 */
async function computeHmacSha256(data: string, key: string): Promise<string> {
    const BLOCK_SIZE = 64; // SHA-256 block size in bytes
    const OPAD = 0x5c;
    const IPAD = 0x36;

    // Convert key to bytes
    let keyBytes = stringToBytes(key);

    // If key is longer than block size, hash it first
    if (keyBytes.length > BLOCK_SIZE) {
        const hashed = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            key,
            { encoding: Crypto.CryptoEncoding.HEX }
        );
        keyBytes = hexToBytes(hashed);
    }

    // Pad key to block size
    const paddedKey = new Uint8Array(BLOCK_SIZE);
    paddedKey.set(keyBytes);

    // Create inner and outer padded keys
    const innerKey = new Uint8Array(BLOCK_SIZE);
    const outerKey = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        innerKey[i] = paddedKey[i] ^ IPAD;
        outerKey[i] = paddedKey[i] ^ OPAD;
    }

    // Inner hash: H((K' ⊕ ipad) || m)
    const innerData = bytesToString(innerKey) + data;
    const innerHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        innerData,
        { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Outer hash: H((K' ⊕ opad) || inner_hash)
    const outerData = bytesToString(outerKey) + hexToString(innerHash);
    const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        outerData,
        { encoding: Crypto.CryptoEncoding.HEX }
    );

    return signature;
}

function stringToBytes(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
}

function bytesToString(bytes: Uint8Array): string {
    return String.fromCharCode(...bytes);
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function hexToString(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
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
            // Fetch from server (endpoint returns user's locationSecret)
            const response = await apiClient.get<{ locationSecret: string }>('/api/users/me/location-secret');
            secret = response.locationSecret;
            
            if (secret) {
                // Store securely for future use
                await SecureStore.setItemAsync(LOCATION_SECRET_KEY, secret);
            }
        }
        
        return secret;
    } catch (error) {
        console.error('Failed to get location secret:', error);
        return null;
    }
}

/**
 * Clear the location secret from secure storage.
 * Call this on logout to ensure clean state.
 */
export async function clearLocationSecret(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(LOCATION_SECRET_KEY);
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

export function useLocation() {
    const [preference, setPreference] = useState<LocationSharing>('off');
    const [permission, setPermission] = useState<LocationPermission | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Get current user from auth context
    const { user } = useAuth();

    // ─────────────────────────────────────────────────────────────────────
    // Load preference and permission from storage on mount
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem('locationSharing'),
            AsyncStorage.getItem('locationPermission')
        ]).then(([sharing, perm]) => {
            if (sharing) setPreference(sharing as LocationSharing);
            if (perm) setPermission(perm as LocationPermission);
        });
    }, []);

    // ─────────────────────────────────────────────────────────────────────
    // Check if we should update location (debouncing logic)
    // ─────────────────────────────────────────────────────────────────────
    async function shouldUpdateLocation(
        currentPosition: Location.LocationObject  // Accept position 
    ): Promise<boolean> {
        try {
            const lastLocationStr = await AsyncStorage.getItem('lastLocation');
            if (!lastLocationStr) return true; // First time, always update

            const lastLocation: LastLocation = JSON.parse(lastLocationStr);
            const now = Date.now();
            const hoursSinceUpdate = (now - lastLocation.timestamp) / (1000 * 60 * 60);

            // RULE 1: Don't update if last update was < 1 hour ago
            if (hoursSinceUpdate < 1) {
                console.log('Skipping update: last update was < 1 hour ago');
                return false;
            }

            // RULE 2: Always update if last update was > 24 hours ago
            if (hoursSinceUpdate > 24) {
                console.log('Forcing update: last update was > 24 hours ago');
                return true;
            }

            // RULE 3: Update if user moved > 50km
            // Use the position we already have (no second GPS call!)
            const distance = calculateDistance(
                lastLocation.latitude,
                lastLocation.longitude,
                currentPosition.coords.latitude,
                currentPosition.coords.longitude
            );

            if (distance > 50) {
                console.log(`Update triggered: moved ${distance.toFixed(2)}km`);
                return true;
            }

            console.log('Skipping update: no significant change');
            return false;
        } catch (error) {
            console.error('Error checking if should update:', error);
            return true; // On error, allow update
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Calculate distance between two GPS points (Haversine formula)
    // ─────────────────────────────────────────────────────────────────────
    function calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth's radius in km
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

    function toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Request OS location permission
    // ─────────────────────────────────────────────────────────────────────
    async function requestPermission(): Promise<boolean> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'We need location access to show your city on your profile.'
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error requesting permission:', error);
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Generate HMAC signature for location payload
    // ─────────────────────────────────────────────────────────────────────
    async function generateSignature(payload: {
        userId: string;
        latitude: number;
        longitude: number;
        timestamp: string;
        nonce: string;
    }): Promise<string> {
        // Get the location secret from secure storage
        const secret = await getLocationSecret();
        if (!secret) {
            throw new Error('Location secret not available. Please re-authenticate.');
        }

        // Build the data string in EXACT format required by server
        // CRITICAL: Order matters! Server expects: userId|lat|lon|timestamp|nonce
        const { userId, latitude, longitude, timestamp, nonce } = payload;
        const data = `${userId}|${latitude}|${longitude}|${timestamp}|${nonce}`;

        // Compute HMAC-SHA256 signature
        // expo-crypto doesn't have native HMAC, so we use the secret as key
        // Server uses: crypto.createHmac('sha256', secret).update(data).digest('hex')
        // We replicate this by creating a keyed hash
        const signature = await computeHmacSha256(data, secret);

        return signature;
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
            // 1. Request permission
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                setLoading(false);
                return;
            }

            // 2. Get GPS coordinates ONCE (battery optimization)
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // 3. Check if we should update (using the position we just got)
            const shouldUpdate = await shouldUpdateLocation(location);
            if (!shouldUpdate) {
                console.log('Location update skipped (debounced)');
                setLoading(false);
                return;
            }

            const { latitude, longitude } = location.coords;

            // 4. Detect OS permission level
            const backgroundPerm = await Location.getBackgroundPermissionsAsync();
            const osPermission: LocationPermission = backgroundPerm.granted
                ? 'always'
                : 'whileUsing';

            // Save permission locally
            await AsyncStorage.setItem('locationPermission', osPermission);
            setPermission(osPermission);

            // 5. Check if user is authenticated
            if (!user?.id) {
                throw new Error('User not authenticated. Please log in again.');
            }

            // 6. Build signed payload with HMAC signature
            const timestamp = new Date().toISOString();
            const nonce = Crypto.randomUUID();
            const signature = await generateSignature({
                userId: user.id,
                latitude,
                longitude,
                timestamp,
                nonce,
            });

            // 7. Send to server (GPS coordinates only - server does reverse geocoding)
            const response = await apiClient.patch<{
                success: boolean;
                city: string;
                country: string;
                locationSharing: string;
            }>('/api/users/me/location', {
                latitude,
                longitude,
                timestamp,
                nonce,
                signature,
                locationSharing: preference,  // 'on' or 'off'
                locationPermission: osPermission,  // 'always' or 'whileUsing'
            });

            // 8. Save last location locally (for debouncing)
            await AsyncStorage.setItem(
                'lastLocation',
                JSON.stringify({
                    latitude,
                    longitude,
                    timestamp: Date.now(),
                })
            );

            // 9. Update UI state with server response
            if (response.city && response.country) {
                setCurrentLocation(`${response.city}, ${response.country}`);
            }
            setLastUpdated(new Date());

            console.log('Location updated successfully:', response);
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
        // 1. Save to local storage
        await AsyncStorage.setItem('locationSharing', newPref);
        setPreference(newPref);

        // 2. If user just enabled location, update immediately
        if (newPref === 'on') {
            // This will detect OS permission and update location
            await updateLocationNow();
        } else {
            // User disabled location - clear current location display
            setCurrentLocation(null);
            setLastUpdated(null);

            // Notify server that location sharing is off
            try {
                await apiClient.patch('/api/users/me/location-settings', {
                    locationSharing: 'off',
                });
            } catch (error) {
                console.error('Failed to update location sharing preference:', error);
            }
        }
        // TODO: If user chose "always", register background task
        // if (newPref === 'always') {
        //     await registerBackgroundLocationTask();
        // } else {
        //     await unregisterBackgroundLocationTask();
        // }
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
    useEffect(() => {
        if (preference === 'on') {
            // Auto-update on app launch (respects debouncing)
            updateLocationNow();
        }
    }, []); // Run once on mount (preference changes handled in changePreference)

    return {
        preference,
        permission,
        loading,
        currentLocation,
        lastUpdated,
        updateLocationNow,
        changePreference,
    };
};
