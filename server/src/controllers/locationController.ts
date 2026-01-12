/**
 * @file src/controllers/locationController.ts
 * @description Controller that processes the PATCH /users/me/location request.
 *
 * It validates the incoming payload (city, country, latitude, longitude,
 * timestamp, nonce, and HMAC signature), checks the timestamp freshness,
 * ensures the nonce has not been used before, verifies the signature using
 * the per‑install secret, and finally updates the user record in the
 * Prisma database with the new location fields and optional `locationSharing`
 * preference.
 *
 * The controller is invoked by `src/routes/location.ts` and returns a JSON
 * response `{ success: true, city, country, locationSharing }` on success.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { reverseGeocode } from '../services/geocoding.service.js';
import { verifySignature, isNonceUsed, markNonceUsed } from '../utils/locationSecurity.js';
import { auditLog, AuditAction } from '../services/auditLog.service.js';

/**
 * PATCH /users/me/location
 * 
 * SECURITY UPDATE: Client now sends only latitude/longitude.
 * Server performs reverse geocoding to prevent clients from faking city/country.
 * 
 * Expected body:
 *   {
 *     latitude: number,
 *     longitude: number,
 *     timestamp: string (ISO),
 *     nonce: string,
 *     signature: string,
 *     locationSharing?: 'always' | 'whileOpen' | 'never'
 *   }
 */
export async function updateLocationHandler(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).user.id; // set by auth middleware
    const {
        latitude,
        longitude,
        timestamp,
        nonce,
        signature,
        locationSharing,
    } = req.body as any;

    // ---- Basic sanity checks ----
    if (latitude === undefined || longitude === undefined) {
        return reply.status(400).send({ error: 'latitude and longitude are required' });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
        return reply.status(400).send({ error: 'latitude must be between -90 and 90' });
    }
    if (longitude < -180 || longitude > 180) {
        return reply.status(400).send({ error: 'longitude must be between -180 and 180' });
    }

    // ---- Verify timestamp (must be within 5 minutes) ----
    const now = Date.now();
    const payloadTime = new Date(timestamp).getTime();
    if (Math.abs(now - payloadTime) > 5 * 60 * 1000) {
        return reply.status(400).send({ error: 'timestamp out of range' });
    }

    // ---- Verify nonce uniqueness ----
    if (await isNonceUsed(nonce)) {
        return reply.status(400).send({ error: 'nonce already used' });
    }

    // ---- SERVER-SIDE GEOCODING (Security Fix) ----
    // Moved from client to prevent:
    // - Fake city/country submissions
    // - Client-side rate limit exhaustion
    // - API key exposure
    let city = '';
    let country = '';

    try {
        const geocoded = await reverseGeocode(latitude, longitude);
        city = geocoded.city;
        country = geocoded.country;
    } catch (error) {
        req.log.error(error, 'Geocoding failed');
        // Continue with empty city/country (graceful degradation)
        // Location update still succeeds, just without readable address
    }

    // ---- Verify signature (HMAC with per‑user secret) ----
    // Note: Signature now covers lat/lon only (not city/country, since server generates those)
    const isValid = await verifySignature({
        userId,
        latitude,
        longitude,
        timestamp,
        nonce,
        signature,
    });
    if (!isValid) {
        return reply.status(400).send({ error: 'invalid signature' });
    }

    // Mark nonce as used to prevent replay attacks
    await markNonceUsed(nonce);

    // ---- Update user record ----
    await prisma.user.update({
        where: { id: userId },
        data: {
            city,
            country,
            latitude,
            longitude,
            lastLocationAt: new Date(timestamp),
            ...(locationSharing ? { locationSharing } : {}),
        },
    });

    // ---- Audit log (security tracking) ----
    await auditLog({
        userId,
        action: AuditAction.LOCATION_UPDATE,
        metadata: {
            city,
            country,
            locationSharing: locationSharing || 'unchanged',
            source: 'gps',
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    return reply.send({ success: true, city, country, locationSharing });
}
