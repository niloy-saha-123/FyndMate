/**
 * @file src/utils/locationSecurity.ts
 * @description Security utilities for verifying signed location updates.
 * Handles nonce verification (replay protection) and HMAC signature validation.
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

// TODO [10K Users]: Add rate limit on nonce validation itself to prevent nonce enumeration attacks
// TODO [10K Users]: Consider persisting critical nonces to DB for replay protection during Redis restarts

/**
 * Checks whether a nonce has already been used.
 * Prevents replay attacks using a shared Redis cache.
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
    const exists = await redis.exists(`nonce:${nonce}`);
    return exists === 1;
}

/**
 * Marks a nonce as used and sets it to expire after 10 minutes.
 */
export async function markNonceUsed(nonce: string): Promise<void> {
    await redis.set(`nonce:${nonce}`, '1', 'EX', 10 * 60);
}

/**
 * Retrieves the per-user secret for HMAC signature verification.
 */
async function getUserSecret(userId: string): Promise<Buffer> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locationSecret: true },
    });

    if (!user || !user.locationSecret) {
        console.error('Critical: missing locationSecret during signature verification', {
            userId,
            timestamp: new Date().toISOString()
        });

        throw new Error('Invalid signature');
    }

    return Buffer.from(user.locationSecret, 'utf-8');
}

/**
 * Verifies the HMAC-SHA256 signature of the payload.
 * The signature covers: userId, latitude, longitude, timestamp, nonce.
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

    if (expected.length !== signature.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
