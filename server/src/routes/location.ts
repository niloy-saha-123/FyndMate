/**
 * @file src/routes/location.ts
 * @description Routes for managing user location, geocoding secrets, and sharing preferences.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { updateLocationHandler } from '../controllers/locationController.js';
import { prisma } from '../lib/prisma.js';
import { rateLimit } from '../middleware/rateLimit.js';

export async function locationRoutes(app: FastifyInstance) {
    /**
     * GET /users/me/location-secret
     * Returns the user's HMAC secret for signing location payloads.
     */
    app.get('/users/me/location-secret', {
        preValidation: [authMiddleware],
        preHandler: [
            rateLimit({ limit: 5, windowSec: 3600, keyPrefix: 'loc_secret' })
        ]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        // TODO [POST-MVP]: Define AuthenticatedRequest type to avoid (req as any).user casts.
        const userId = (req as any).user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { locationSecret: true }
        });

        if (!user || !user.locationSecret) {
            // TODO [POST-MVP]: Add secret rotation with versioning (current + previous) to allow safe key rollover.
            // TODO [POST-MVP]: Store per-device secrets to limit blast radius if a device is compromised.
            // TODO [POST-MVP]: Encrypt location secrets at rest (KMS/Vault) instead of storing plaintext.
            const newSecret = crypto.randomBytes(32).toString('hex');
            await prisma.user.update({
                where: { id: userId },
                data: { locationSecret: newSecret }
            });
            return reply.send({ locationSecret: newSecret });
        }

        return reply.send({ locationSecret: user.locationSecret });
    });

    /**
     * PATCH /users/me/location-settings
     * Update location sharing preference.
     */
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
        // TODO [POST-MVP]: Define AuthenticatedRequest type to avoid (req as any).user casts.
        const userId = (req as any).user.id;
        const { locationSharing } = req.body as { locationSharing: 'on' | 'off' };

        await prisma.user.update({
            where: { id: userId },
            data: { locationSharing }
        });

        return reply.send({ success: true, locationSharing });
    });

    /**
     * PATCH /users/me/location
     * Update user location from trusted GPS coordinates with HMAC signature.
     */
    app.patch('/users/me/location', {
        preValidation: [authMiddleware],
        preHandler: [
            rateLimit({ limit: 10, windowSec: 3600, keyPrefix: 'loc' })
        ],
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
