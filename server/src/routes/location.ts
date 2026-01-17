/**
 * @file src/routes/location.ts
 * @description Fastify routes for location management.
 *
 * Endpoints:
 * - GET  /users/me/location-secret  - Get user's HMAC secret for signing
 * - PATCH /users/me/location        - Update location with signed payload
 * - PATCH /users/me/location-settings - Update location sharing preference
 *
 * The routes are registered in `src/app.ts` under the `/api` prefix.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { updateLocationHandler } from '../controllers/locationController.js';
import { prisma } from '../lib/prisma.js';

export async function locationRoutes(app: FastifyInstance) {
    // ─────────────────────────────────────────────────────────────────────
    // GET /users/me/location-secret
    // ─────────────────────────────────────────────────────────────────────
    // Returns the user's HMAC secret for signing location payloads.
    // The client stores this securely and uses it to sign all location updates.
    // 
    // SECURITY: This endpoint should only be called once per device/install.
    // The client should cache the secret in secure storage (expo-secure-store).
    // ─────────────────────────────────────────────────────────────────────
    app.get('/users/me/location-secret', {
        preValidation: [authMiddleware],
        config: {
            // Rate limit to prevent abuse
            rateLimit: {
                max: 5,
                timeWindow: '1 hour'
            }
        }
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        const userId = (req as any).user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { locationSecret: true }
        });

        if (!user || !user.locationSecret) {
            // Generate a new secret if one doesn't exist
            const newSecret = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await prisma.user.update({
                where: { id: userId },
                data: { locationSecret: newSecret }
            });
            return reply.send({ locationSecret: newSecret });
        }

        return reply.send({ locationSecret: user.locationSecret });
    });

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /users/me/location-settings
    // ─────────────────────────────────────────────────────────────────────
    // Update location sharing preference without sending location data.
    // Used when user turns off location sharing.
    // ─────────────────────────────────────────────────────────────────────
    app.patch('/users/me/location-settings', {
        preValidation: [authMiddleware],
        schema: {
            body: {
                type: 'object',
                required: ['locationSharing'],
                properties: {
                    locationSharing: { type: 'string', enum: ['on', 'off'] }
                }
            }
        }
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        const userId = (req as any).user.id;
        const { locationSharing } = req.body as { locationSharing: 'on' | 'off' };

        await prisma.user.update({
            where: { id: userId },
            data: { locationSharing }
        });

        return reply.send({ success: true, locationSharing });
    });

    // ─────────────────────────────────────────────────────────────────────
    // PATCH /users/me/location
    // ─────────────────────────────────────────────────────────────────────
    // Update user location from GPS coordinates.
    // Requires HMAC signature for security.
    // Server performs reverse geocoding to get city/country.
    // ─────────────────────────────────────────────────────────────────────
    app.patch('/users/me/location', {
        preValidation: [authMiddleware],
        config: {
            // Stricter rate limit for location updates
            // Legitimate users only need to update 5-10 times per day
            rateLimit: {
                max: 10, // 10 requests
                timeWindow: '1 hour' // per hour
            }
        },
        schema: {
            body: {
                type: 'object',
                required: ['latitude', 'longitude', 'timestamp', 'nonce', 'signature'],
                properties: {
                    latitude: {
                        type: 'number',
                        minimum: -90,
                        maximum: 90
                    },
                    longitude: {
                        type: 'number',
                        minimum: -180,
                        maximum: 180
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                    nonce: { type: 'string', minLength: 1 },
                    signature: { type: 'string', minLength: 1 },
                    locationSharing: { type: 'string', enum: ['on', 'off'] },
                    locationPermission: { type: 'string', enum: ['always', 'whileUsing', 'denied'] }
                }
            }
        }
    }, updateLocationHandler);
}
