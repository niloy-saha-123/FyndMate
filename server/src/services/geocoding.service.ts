/**
 * @file src/services/geocoding.service.ts
 * @description Server-side reverse geocoding service using OpenStreetMap Nominatim.
 * Handles rate limiting, caching, and circuit breaking for external API calls.
 */

import axios from 'axios';
import { redis } from '../lib/redis.js';
import { withCircuitBreaker } from '../utils/circuit-breaker.js';

/**
 * Queue to enforce OpenStreetMap's 1 request/second rate limit.
 * prevents rate limit violations during concurrent user updates.
 */
class GeocodingQueue {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;
    private lastRequestTime = 0;

    /**
     * Add a request to the queue, ensuring sequential execution.
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

        // Enforce 1-second delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
        }

        await task();
        this.lastRequestTime = Date.now();
        this.processing = false;

        this.processQueue();
    }
}

const geocodingQueue = new GeocodingQueue();

/**
 * Reverse geocode coordinates to city and country.
 * Uses Redis caching (30 days) and a circuit breaker for resilience.
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<{
    city: string;
    country: string;
    success: boolean;
    error?: string;
}> {
    // Round to ~1km precision for efficient caching
    // TODO: Reduce to .toFixed(3-4) to further bound cache cardinality (currently unbounded)
    const cacheKey = `geocode:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.warn('Redis cache error in geocoding (ignoring):', err);
    }

    // Queue the API request to respect rate limits
    const result = await geocodingQueue.add(async () => {
        return withCircuitBreaker(
            'nominatim',
            async () => {
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
                                'User-Agent': process.env.CONTACT_EMAIL
                                    ? `FyndMate/1.0 (${process.env.CONTACT_EMAIL})`
                                    : 'FyndMate/1.0',
                            },
                            timeout: 5000, // TODO: tighten to 3000–5000ms when background updates scale
                        }
                    );

                    const city = response.data.address?.city || response.data.address?.town || '';
                    const country = response.data.address?.country || '';

                    return {
                        city,
                        country,
                        success: true as boolean,
                    };
                } catch (error: any) {
                    console.error('Geocoding failed:', {
                        latitude,
                        longitude,
                        error: error.message,
                        code: error.code,
                        status: error.response?.status,
                    });

                    throw error;
                }
            },
            () => ({
                city: '',
                country: '',
                success: false,
                error: 'Geocoding service unavailable (circuit breaker open)',
            }),
            {
                failureThreshold: 5,
                cooldownSeconds: 60,
                windowSeconds: 300,
            }
        );
    });

    if (result.success) {
        try {
            // Cache successful results for 30 days
            await redis.setex(cacheKey, 30 * 24 * 60 * 60, JSON.stringify(result));
        } catch (err) {
            console.warn('Redis cache write error in geocoding:', err);
        }
    }

    return result;
}

// TODO: Upgrade to a paid service (Mapbox/Google) when scaling beyond free tier limits.

