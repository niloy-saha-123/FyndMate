/**
 * @file src/utils/locationSecurity.ts
 * @description Utility functions for securing the location update payload.
 *
 * This module provides:
 *   • `isNonceUsed` – checks an in‑memory cache (or Redis in production) to
 *     ensure a nonce has not been reused, preventing replay attacks.
 *   • `markNonceUsed` – records a nonce as used and automatically expires it
 *     after a short TTL (default 10 minutes).
 *   • `verifySignature` – validates the HMAC‑SHA256 signature that the client
 *     generates with a per‑install secret. The signature covers the user ID, city,
 *     country, latitude, longitude, timestamp and nonce.
 *
 * These helpers are used by `src/controllers/locationController.ts` to guarantee
 * that the location data truly originates from the legitimate mobile app and has
 * not been tampered with.
 */
// src/utils/locationSecurity.ts
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

/**
 * In‑memory cache for recent nonces to prevent replay attacks.
 * 
 * ⚠️ TODO: REPLACE WITH REDIS BEFORE PRODUCTION
 * 
 * PROBLEM: In-memory storage breaks with multiple server instances.
 * If we have 2+ servers behind a load balancer, a nonce stored on Server A
 * won't be visible to Server B, allowing replay attacks.
 * 
 * SOLUTION: Use Redis (shared cache across all servers) for Mahdi bro work on this
 * 
 * Example Redis implementation:
 * ```typescript
 * import { createClient } from 'redis';
 * 
 * const redis = createClient({
 *   url: process.env.REDIS_URL || 'redis://localhost:6379'
 * });
 * await redis.connect();
 * 
 * export async function isNonceUsed(nonce: string): Promise<boolean> {
 *   const exists = await redis.exists(`nonce:${nonce}`);
 *   return exists === 1;
 * }
 * 
 * export async function markNonceUsed(nonce: string): Promise<void> {
 *   // Set with 10-minute expiration (600 seconds)
 *   await redis.setex(`nonce:${nonce}`, 600, '1');
 * }
 * ```
 * 
 * Timeline: Implement before deploying multiple server instances
 */
const recentNonces = new Set<string>();

/**
 * Checks whether a nonce has already been used.
 * Returns true if the nonce exists in the cache.
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
    return recentNonces.has(nonce);
}

/**
 * Marks a nonce as used and sets it to expire after 10 minutes.
 */
export async function markNonceUsed(nonce: string): Promise<void> {
    recentNonces.add(nonce);
    // Auto‑expire after 10 minutes
    setTimeout(() => recentNonces.delete(nonce), 10 * 60 * 1000);
}

/**
 * Retrieves the per‑user secret for HMAC signature verification.
 * 
 * SECURITY FIX: Now uses a random secret stored in the database (User.locationSecret).
 * Each user gets a unique 256-bit random value generated on account creation.
 * 
 * This prevents:
 * - Secret prediction (old deterministic approach was vulnerable)
 * - Cross-user signature reuse
 * - Offline brute-force attacks
 */
async function getUserSecret(userId: string): Promise<Buffer> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locationSecret: true },
    });

    if (!user || !user.locationSecret) {
        // Log detailed error internally for debugging
        console.error('Critical: missing locationSecret during signature verification', {
            userId,
            hasUserRecord: !!user,
            hasLocationSecret: !!user?.locationSecret,
            timestamp: new Date().toISOString()
        });

        // Return generic error to client (same as invalid signature)
        // This prevents information leakage about database structure
        throw new Error('Invalid signature');
    }

    // Convert the cuid string to a Buffer for HMAC
    return Buffer.from(user.locationSecret, 'utf-8');
}

/**
 * Verifies the HMAC‑SHA256 signature of the payload.
 * 
 * SECURITY UPDATE: Signature now only covers lat/lon (not city/country).
 * This is because the server generates city/country via geocoding, so the client
 * can't include them in the signature.
 * 
 * The client must compute the signature over the concatenated string of:
 *   userId|latitude|longitude|timestamp|nonce
 */
export async function verifySignature(payload: {
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    nonce: string;
    signature: string;
}): Promise<boolean> {
    const { userId, latitude, longitude, timestamp, nonce, signature } = payload;
    const secret = await getUserSecret(userId);
    const data = `${userId}|${latitude}|${longitude}|${timestamp}|${nonce}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
