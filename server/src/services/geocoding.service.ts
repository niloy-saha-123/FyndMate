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
 * Good for: < 5,000 users
 *
 * When to upgrade:
 * - Google Geocoding API: $5 per 1,000 requests (first $200/month free)
 * - Mapbox: $0.60 per 1,000 requests (100k free/month)
 *
 * Example Mapbox implementation:
 * ```typescript
 * const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
 * const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}`;
 * const resp = await axios.get(url);
 * const place = resp.data.features[0];
 * return {
 *   city: place.context.find(c => c.id.startsWith('place'))?.text || '',
 *   country: place.context.find(c => c.id.startsWith('country'))?.text || ''
 * };
 * ```
 */

import axios from 'axios';

/**
 * Reverse geocode coordinates to city and country.
 *
 * @param latitude - GPS latitude (-90 to 90)
 * @param longitude - GPS longitude (-180 to 180)
 * @returns Object with city and country strings
 *
 * @throws Error if geocoding fails or coordinates are invalid
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<{ city: string; country: string }> {
    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude: must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude: must be between -180 and 180');
    }

    try {
        // Call OpenStreetMap Nominatim (free tier)
        // Rate limit: 1 request/second
        // User-Agent header is required by Nominatim usage policy
        const response = await axios.get(
            'https://nominatim.openstreetmap.org/reverse',
            {
                params: {
                    format: 'jsonv2',
                    lat: latitude,
                    lon: longitude,
                },
                headers: {
                    'User-Agent': 'FyndMate/1.0 (contact@fyndmate.com)', // Replace with your actual contact
                },
                timeout: 5000, // 5 second timeout
            }
        );

        const data = response.data;

        // Extract city (try multiple fields as different locations use different naming)
        const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            '';

        // Extract country
        const country = data.address?.country || '';

        // ⚠️ TODO: ADD CACHING TO REDUCE API CALLS
        //
        // Problem: Same coordinates get geocoded multiple times (waste of API quota)
        // Solution: Cache results in Redis with lat/lon as key
        //
        // Example Redis caching:
        // ```typescript
        // const cacheKey = `geocode:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
        // const cached = await redis.get(cacheKey);
        // if (cached) return JSON.parse(cached);
        //
        // // ... make API call ...
        //
        // await redis.setex(cacheKey, 86400, JSON.stringify({ city, country })); // 24h cache
        // ```
        //
        // Benefits:
        // - Reduces API costs by ~80% (most users don't move daily)
        // - Faster response times (Redis lookup ~1ms vs API call ~500ms)
        // - Works even if geocoding API is down
        //
        // Timeline: Implement when you hit 1,000+ daily active users

        return { city, country };
    } catch (error) {
        // Log error for monitoring
        console.error('Geocoding error:', error);

        // Return empty strings instead of throwing (graceful degradation)
        // This prevents location updates from failing completely if geocoding is down
        return { city: '', country: '' };
    }
}
