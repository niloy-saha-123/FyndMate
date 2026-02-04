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
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────────────────────────────
// SECURE STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────
const LOCATION_SECRET_KEY = 'fyndmate_location_secret';

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
            // Fetch from server (endpoint returns user's locationSecret)
            const response = await apiClient.get<{ locationSecret: string }>('/api/users/me/location-secret');
            secret = response.locationSecret;
            
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

export function useLocation() {
    const [preference, setPreference] = useState<LocationSharing>('off');
    const [permission, setPermission] = useState<LocationPermission | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Get current user from auth context
    const { user } = useAuth();

    // Note: preference/permission loading is handled in the initialization effect at the bottom

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

        console.log('📍 Generating signature for data:', data);
        console.log('📍 Using secret (first 10 chars):', secret.substring(0, 10) + '...');

        // Compute HMAC-SHA256 signature using crypto-js
        // Server uses: crypto.createHmac('sha256', secret).update(data).digest('hex')
        const signature = computeHmacSha256(data, secret);

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
        console.log('📍 Starting location update...');
        
        try {
            // 1. Request permission
            console.log('📍 Step 1: Requesting permission...');
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                console.log('📍 Permission denied');
                setLoading(false);
                return;
            }

            // 2. Get GPS coordinates ONCE (battery optimization)
            console.log('📍 Step 2: Getting GPS coordinates...');
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            console.log('📍 GPS coordinates:', location.coords.latitude, location.coords.longitude);

            // 3. Check if we should update (using the position we just got)
            const shouldUpdate = await shouldUpdateLocation(location);
            if (!shouldUpdate) {
                console.log('📍 Location update skipped (debounced)');
                setLoading(false);
                return;
            }

            const { latitude, longitude } = location.coords;

            // 4. Detect OS permission level
            console.log('📍 Step 4: Checking OS permission level...');
            const backgroundPerm = await Location.getBackgroundPermissionsAsync();
            const osPermission: LocationPermission = backgroundPerm.granted
                ? 'always'
                : 'whileUsing';
            console.log('📍 OS permission:', osPermission);

            // Save permission locally
            await AsyncStorage.setItem('locationPermission', osPermission);
            setPermission(osPermission);

            // 5. Check if user is authenticated
            if (!user?.id) {
                throw new Error('User not authenticated. Please log in again.');
            }
            console.log('📍 Step 5: User ID:', user.id);

            // 6. Build signed payload with HMAC signature
            console.log('📍 Step 6: Generating HMAC signature...');
            const timestamp = new Date().toISOString();
            const nonce = Crypto.randomUUID();
            const signature = await generateSignature({
                userId: user.id,
                latitude,
                longitude,
                timestamp,
                nonce,
            });
            console.log('📍 Signature generated:', signature.substring(0, 20) + '...');

            // 7. Send to server (GPS coordinates only - server does reverse geocoding)
            console.log('📍 Step 7: Sending to server...');
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

            console.log('📍 Server response:', response);

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
                console.log('📍 Location set to:', response.city, response.country);
            } else {
                console.log('📍 No city/country in response');
            }
            setLastUpdated(new Date());

            console.log('✅ Location updated successfully!');
        } catch (error: any) {
            console.error('❌ Error updating location:', error);
            console.error('❌ Error details:', error.message, error.stack);
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
    const [initialized, setInitialized] = useState(false);
    
    // Load saved preference first, then auto-update if enabled
    useEffect(() => {
        async function initLocation() {
            // Load saved preference from storage
            const savedPref = await AsyncStorage.getItem('locationSharing');
            const savedPerm = await AsyncStorage.getItem('locationPermission');
            
            if (savedPref) {
                setPreference(savedPref as LocationSharing);
            }
            if (savedPerm) {
                setPermission(savedPerm as LocationPermission);
            }
            
            setInitialized(true);
            
            // Auto-update on app launch if preference is 'on'
            if (savedPref === 'on') {
                console.log('📍 Auto-updating location on app launch...');
                // Small delay to ensure everything is ready
                setTimeout(() => {
                    updateLocationNow();
                }, 500);
            }
        }
        
        initLocation();
    }, []); // Run once on mount

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