/**
 * @file src/utils/locationSecurity.ts
 * @description Security utilities for verifying signed location updates.
 * Handles nonce verification (replay protection) and HMAC signature validation.
 * 
 * Uses hybrid nonce store with Redis + in-memory fallback for reliability.
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { nonceStore } from '../nonce-store/index.js';

// TODO [5K Users]: Add rate limit on nonce validation itself to prevent nonce enumeration attacks
// TODO [10K Users]: Implement nonce preflight validation (check format/length before storage)

/**
 * Checks whether a nonce has already been used.
 * Uses hybrid nonce store (Redis + in-memory fallback).
 * 
 * SECURITY CRITICAL: Always fails closed - if check fails, treats nonce as used.
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
    try {
        return await nonceStore.isUsed(nonce);
    } catch (error) {
        // FAIL CLOSED: On error, treat nonce as used (reject request)
        console.error('🚨 CRITICAL: Nonce validation failed, failing closed:', error);
        return true;
    }
}

/**
 * Marks a nonce as used and sets it to expire after 10 minutes.
 * Uses hybrid nonce store (Redis + in-memory fallback).
 * 
 * SECURITY CRITICAL: If storage fails, throws error to reject the request.
 */
export async function markNonceUsed(nonce: string): Promise<void> {
    const NONCE_TTL_SECONDS = 10 * 60; // 10 minutes
    // TODO [POST-MVP]: Align nonce TTL with a tighter timestamp window if we reduce it.
    
    try {
        await nonceStore.markUsed(nonce, NONCE_TTL_SECONDS);
    } catch (error) {
        // FAIL CLOSED: If we can't store the nonce, reject the request
        console.error('🚨 CRITICAL: Failed to mark nonce as used:', error);
        throw new Error('Failed to validate location update. Please try again.');
    }
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
    supabaseId: string; // Used by the client to generate the HMAC
    latitude: number;
    longitude: number;
    timestamp: string;
    nonce: string;
    signature: string;
}): Promise<boolean> {
    const { userId, supabaseId, latitude, longitude, timestamp, nonce, signature } = payload;
    const secret = await getUserSecret(userId);
    const data = `${supabaseId}|${latitude}|${longitude}|${timestamp}|${nonce}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');

    if (expected.length !== signature.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
