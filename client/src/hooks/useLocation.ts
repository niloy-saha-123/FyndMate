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
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Import the API client
// import { api } from '@/src/services/api';

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

    // TODO: Get current user from auth context
    // const { user } = useAuth();

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
        // ═════════════════════════════════════════════════════════════════
        // TODO: CRITICAL - IMPLEMENT HMAC SIGNATURE (@mohdfaraz)
        // ═════════════════════════════════════════════════════════════════
        // 
        // CURRENT STATUS: Location updates will FAIL until this is implemented
        // Server rejects all requests with 'invalid signature' error
        // 
        // WHAT THIS DOES:
        // Creates a cryptographic signature to prove the location data
        // came from the legitimate app and wasn't tampered with.
        // 
        // IMPLEMENTATION STEPS:
        // 
        // Step 1: Install required package
        // ─────────────────────────────────
        // npm install expo-crypto
        // 
        // Step 2: Import at top of file
        // ─────────────────────────────────
        // import * as Crypto from 'expo-crypto';
        // import * as SecureStore from 'expo-secure-store';
        // 
        // Step 3: Get or create per-device secret
        // ─────────────────────────────────────────
        // const secret = await SecureStore.getItemAsync('locationSecret');
        // if (!secret) {
        //   const newSecret = Crypto.randomUUID();
        //   await SecureStore.setItemAsync('locationSecret', newSecret);
        //   // Use newSecret for this request
        // }
        // 
        // Step 4: Build the data string (EXACT format required by server)
        // ─────────────────────────────────────────────────────────────────
        // const { userId, latitude, longitude, timestamp, nonce } = payload;
        // const data = `${userId}|${latitude}|${longitude}|${timestamp}|${nonce}`;
        // 
        // CRITICAL: Order matters! Server expects: userId|lat|lon|timestamp|nonce
        // 
        // Step 5: Compute HMAC-SHA256 signature
        // ──────────────────────────────────────
        // const signature = await Crypto.digestStringAsync(
        //   Crypto.CryptoDigestAlgorithm.SHA256,
        //   data + secret,  // Concatenate data with secret
        //   { encoding: Crypto.CryptoEncoding.HEX }
        // );
        // 
        // Step 6: Return the hex signature
        // ─────────────────────────────────
        // return signature;
        // 
        // SECURITY NOTES:
        // - The secret MUST be stored in SecureStore (encrypted storage)
        // - NEVER hardcode the secret or store in AsyncStorage
        // - Each device should have a unique secret
        // - Server validates this signature to prevent location spoofing
        // 
        // TESTING:
        // After implementation, test with:
        // 1. Enable location sharing in app
        // 2. Tap "Update Location Now"
        // 3. Check server logs - should see "Location updated successfully"
        // 4. If you see "invalid signature", the data string format is wrong
        // 
        // ═════════════════════════════════════════════════════════════════

        return 'PLACEHOLDER_SIGNATURE'; // ← REPLACE THIS ENTIRE RETURN STATEMENT
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

            // 5. Build signed payload
            // TODO: Uncomment this when implementing API integration
            // Get current user ID from auth context:
            // const { user } = useAuth();
            // const userId = user.id;
            // const timestamp = new Date().toISOString();
            // const nonce = Crypto.randomUUID();
            // const signature = await generateSignature({
            //     userId,
            //     latitude,
            //     longitude,
            //     timestamp,
            //     nonce,
            // });

            // 6. Send to server
            // TODO: Replace with the actual API client and uncomment
            // await api.patch('/users/me/location', {
            //     latitude,
            //     longitude,
            //     timestamp,
            //     nonce,
            //     signature,
            //     locationSharing: preference,  // 'on' or 'off'
            //     locationPermission: osPermission,  // 'always' or 'whileUsing'
            // });

            // 7. Save last location locally (for debouncing)
            await AsyncStorage.setItem(
                'lastLocation',
                JSON.stringify({
                    latitude,
                    longitude,
                    timestamp: Date.now(),
                })
            );

            // 8. Update UI state
            // TODO: The server returns { city, country } - update local state
            // setCurrentLocation(`${response.city}, ${response.country}`);
            setLastUpdated(new Date());

            Alert.alert('Success', 'Location updated!');
        } catch (error) {
            console.error('Error updating location:', error);
            Alert.alert('Error', 'Failed to update location. Please try again.');
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

            // Send to server (just the preference, no location data)
            // TODO: Replace with the actual API client
            // await api.patch('/users/me/location-settings', {
            //     locationSharing: 'off',
            // });
        }
        // 4. TODO: If user chose "always", register background task
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
