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
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Import your API client
// import { api } from '@/src/services/api';

// TODO: Import your auth context to get current user ID
// import { useAuth } from '@/src/contexts/AuthContext';

type LocationSharing = 'never' | 'whileOpen' | 'always';

interface LastLocation {
    latitude: number;
    longitude: number;
    timestamp: number;
}

export const useLocation = () => {
    const [preference, setPreference] = useState<LocationSharing>('whileOpen');
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // TODO: Get current user from auth context
    // const { user } = useAuth();

    // ─────────────────────────────────────────────────────────────────────
    // Load preference from local storage on mount
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        loadPreference();
    }, []);

    async function loadPreference() {
        try {
            const saved = await AsyncStorage.getItem('locationSharing');
            if (saved) {
                setPreference(saved as LocationSharing);
            }
        } catch (error) {
            console.error('Failed to load location preference:', error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Check if we should update location (debouncing logic)
    // ─────────────────────────────────────────────────────────────────────
    async function shouldUpdateLocation(): Promise<boolean> {
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
            const currentPos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const distance = calculateDistance(
                lastLocation.latitude,
                lastLocation.longitude,
                currentPos.coords.latitude,
                currentPos.coords.longitude
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
        // TODO: Implement HMAC-SHA256 signature generation
        // 
        // 1. Get the per-install secret from secure storage:
        //    const secret = await SecureStore.getItemAsync('locationSecret');
        //    if (!secret) {
        //      const newSecret = crypto.randomUUID();
        //      await SecureStore.setItemAsync('locationSecret', newSecret);
        //      return newSecret;
        //    }
        //
        // 2. Build the data string:
        //    const data = `${userId}|${latitude}|${longitude}|${timestamp}|${nonce}`;
        //
        // 3. Compute HMAC-SHA256:
        //    Use expo-crypto or react-native-crypto
        //    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
        //
        // 4. Return the hex string

        return 'PLACEHOLDER_SIGNATURE'; // Replace with actual implementation
    }

    // ─────────────────────────────────────────────────────────────────────
    // Update location now (main function)
    // ─────────────────────────────────────────────────────────────────────
    async function updateLocationNow() {
        if (preference === 'never') {
            Alert.alert(
                'Location Disabled',
                'Enable location sharing in Settings to update your location.'
            );
            return;
        }

        // Check if we should update (debouncing)
        const shouldUpdate = await shouldUpdateLocation();
        if (!shouldUpdate) {
            console.log('Location update skipped (debounced)');
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

            // 2. Get GPS coordinates
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // 3. Build signed payload
            // TODO: Get current user ID from auth context
            const userId = 'REPLACE_WITH_ACTUAL_USER_ID'; // user.id
            const timestamp = new Date().toISOString();
            const nonce = crypto.randomUUID();
            const signature = await generateSignature({
                userId,
                latitude,
                longitude,
                timestamp,
                nonce,
            });

            // 4. Send to server
            // TODO: Replace with your actual API client
            // await api.patch('/users/me/location', {
            //     latitude,
            //     longitude,
            //     timestamp,
            //     nonce,
            //     signature,
            //     locationSharing: preference,
            // });

            // 5. Save last location locally (for debouncing)
            await AsyncStorage.setItem(
                'lastLocation',
                JSON.stringify({
                    latitude,
                    longitude,
                    timestamp: Date.now(),
                })
            );

            // 6. Update UI state
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
        try {
            // 1. Save locally
            await AsyncStorage.setItem('locationSharing', newPref);
            setPreference(newPref);

            // 2. Send to server (just the preference, no location data)
            // TODO: Replace with your actual API client
            // await api.patch('/users/me/location', {
            //     locationSharing: newPref,
            // });

            // 3. If user just enabled location (from "never" to something else)
            if (newPref !== 'never') {
                // Immediately update location
                await updateLocationNow();
            }

            // 4. TODO: If user chose "always", register background task
            // if (newPref === 'always') {
            //     await registerBackgroundLocationTask();
            // } else {
            //     await unregisterBackgroundLocationTask();
            // }
        } catch (error) {
            console.error('Error changing preference:', error);
            Alert.alert('Error', 'Failed to update preference');
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Auto-update on app launch (if preference allows)
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (preference !== 'never') {
            // Auto-update on app launch (respects debouncing)
            updateLocationNow();
        }
    }, []); // Run once on mount

    return {
        preference,
        changePreference,
        updateLocationNow,
        loading,
        currentLocation,
        lastUpdated,
    };
};
