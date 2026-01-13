/**
 * @file src/services/geocoding.service.ts
 * @description Server-side reverse geocoding service.
 *
 * SECURITY FIX: Moved reverse geocoding from client to server to prevent:
 * - Rate limit exhaustion (client-side calls exposed to abuse)
 * - API key exposure (if using paid services)
 * - Inconsistent data (clients could send fake city/country)
 *
 * This service handles converting GPS coordinates (latitude, longitude) into
 * human-readable location data (city, country) using OpenStreetMap Nominatim.
 *
 * ⚠️ TODO: SWITCH TO PAID SERVICE AT SCALE
 *
 * Current: OpenStreetMap Nominatim (free, rate limit: 1 req/sec)
 * 
 * SECURITY & PRIVACY:
 * - Moves geocoding from client to server (prevents client-side abuse)
 * - Prevents clients from faking city/country names
 * - Centralizes API usage (easier to switch providers later)
 * - Protects API keys from client exposure
 * 
 * RATE LIMITING:
 * - OpenStreetMap Nominatim has a strict 1 request/second limit
 * - We use a queue to ensure we never exceed this limit
 * - Requests are processed sequentially with 1-second delays
 * 
 * SCALING STRATEGY:
 * - Current: OpenStreetMap Nominatim (free, 1 req/sec)
 * - < 1,000 users: Current implementation is fine
 * - 1,000-10,000 users: Add Redis caching (see TODO below)
 * - > 10,000 users: Switch to paid service (Mapbox or Google)
 */

import axios from 'axios';

/**
 * Simple in-memory queue to respect OpenStreetMap's 1 req/sec rate limit.
 * 
 * This prevents rate limit violations when multiple users update location simultaneously.
 * Without this, if 10 users open the app at the same time, 9 requests would fail.
 */
class GeocodingQueue {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;
    private lastRequestTime = 0;

    /**
     * Add a geocoding request to the queue.
     * Ensures 1 second delay between requests.
     */
    async add<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const task = this.queue.shift()!;

        // Ensure at least 1 second between requests (Nominatim rate limit)
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
        }

        await task();
        this.lastRequestTime = Date.now();
        this.processing = false;

        // Process next item in queue
        this.processQueue();
    }
}

const geocodingQueue = new GeocodingQueue();

/**
 * Reverse geocode GPS coordinates to city and country.
 * 
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @returns Object with city, country, and success flag
 * 
 * @example
 * const { city, country, success } = await reverseGeocode(37.7749, -122.4194);
 * if (!success) {
 *     console.warn('Geocoding failed, but location update will still proceed');
 * }
 * // Returns: { city: "San Francisco", country: "United States", success: true }
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<{
    city: string;
    country: string;
    success: boolean;
    error?: string;  // Optional error message for debugging
}> {
    // ─────────────────────────────────────────────────────────────────────
    // TODO: Add Redis caching for production
    // ─────────────────────────────────────────────────────────────────────
    //
    // WHY: Reduces API calls by 90%+ (most users stay in same city)
    // WHEN: Before public launch or when we hit 1,000 daily active users (i think we should do itt before production)
    //
    // IMPLEMENTATION:
    //
    // import { createClient } from 'redis';
    // 
    // const redis = createClient({
    //     url: process.env.REDIS_URL || 'redis://localhost:6379'
    // });
    // await redis.connect();
    //
    // // Round coordinates to ~1km precision (reduces cache misses)
    // const cacheKey = `geocode:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
    //
    // // Check cache first
    // const cached = await redis.get(cacheKey);
    // if (cached) {
    //     console.log('Cache hit for geocoding');
    //     return JSON.parse(cached);
    // }
    //
    // // Make API call (only if cache miss)
    // const result = await reverseGeocodeFromAPI(latitude, longitude);
    //
    // // Cache for 30 days (city names don't change)
    // await redis.setex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(result));
    //
    // return result;
    //
    // EXPECTED IMPACT:
    // - 90%+ cache hit rate (users don't move cities often)
    // - 10x faster responses (no API call needed)
    // - Scales to 100,000+ users on free tier
    // - Respects OpenStreetMap rate limits automatically
    //
    // ─────────────────────────────────────────────────────────────────────

    // Add request to queue (respects 1 req/sec limit)
    return geocodingQueue.add(async () => {
        try {
            const response = await axios.get(
                'https://nominatim.openstreetmap.org/reverse',
                {
                    params: {
                        format: 'jsonv2',
                        lat: latitude,
                        lon: longitude,
                    },
                    headers: {
                        // TODO: Add contact email before production launch
                        // 
                        // OpenStreetMap requires a contact email in User-Agent header.
                        // Without it, they will ban our IP without warning if:
                        // - We exceed 1 req/sec rate limit
                        // - They detect unusual activity
                        // - We hit high volume (> 1,000 req/day)
                        // 
                        // BEFORE LAUNCH:
                        // 1. Create fyndmate.dev@gmail.com (or similar)
                        // 2. Add to .env: CONTACT_EMAIL=fyndmate.dev@gmail.com
                        // 3. Restart server
                        // 
                        // See policy: https://operations.osmfoundation.org/policies/nominatim/
                        'User-Agent': process.env.CONTACT_EMAIL
                            ? `FyndMate/1.0 (${process.env.CONTACT_EMAIL})`
                            : 'FyndMate/1.0',  // Dev mode: no email (acceptable for low volume)
                    },
                    timeout: 5000, // 5 second timeout
                }
            );

            const city = response.data.address?.city || response.data.address?.town || '';
            const country = response.data.address?.country || '';

            return {
                city,
                country,
                success: true,
            };
        } catch (error: any) {
            // Log with context for monitoring and debugging
            console.error('Geocoding failed:', {
                latitude,
                longitude,
                error: error.message,
                code: error.code,
                status: error.response?.status,
            });

            // Graceful degradation: return empty strings but flag as failed
            // This allows location update to succeed while monitoring API health
            return {
                city: '',
                country: '',
                success: false,
                error: error.message || 'Unknown geocoding error',
            };
        }
    });
}

// ─────────────────────────────────────────────────────────────────────
// TODO: Upgrade to paid service like map box when we hit 10,000+ users
// ─────────────────────────────────────────────────────────────────────
//
// services like: Mapbox Geocoding API, Google Geocoding API
//
// IMPLEMENTATION (Mapbox):
//
// export async function reverseGeocode(latitude: number, longitude: number) {
//     const response = await axios.get(
//         `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
//         {
//             params: {
//                 access_token: process.env.MAPBOX_API_KEY,
//                 types: 'place,country',
//             },
//         }
//     );
//
//     const place = response.data.features.find(f => f.place_type.includes('place'));
//     const country = response.data.features.find(f => f.place_type.includes('country'));
//
//     return {
//         city: place?.text || '',
//         country: country?.text || '',
//     };
// }
//
// ─────────────────────────────────────────────────────────────────────

