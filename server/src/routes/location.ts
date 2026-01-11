/**
 * @file src/routes/location.ts
 * @description Fastify route that handles PATCH /users/me/location.
 *
 * This endpoint receives a signed payload containing the user's city, country,
 * latitude, longitude, a timestamp, a nonce and an HMAC signature. It validates
 * the request (auth middleware, schema, signature, timestamp, nonce) and then
 * forwards the data to the `updateLocationHandler` controller.
 *
 * The route is registered in `src/app.ts` under the `/api` prefix.
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { updateLocationHandler } from '../controllers/locationController.js';

export async function locationRoutes(app: FastifyInstance) {
    // PATCH /users/me/location
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
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' },
                    nonce: { type: 'string' },
                    signature: { type: 'string' },
                    locationSharing: { type: 'string', enum: ['always', 'whileOpen', 'never'] }
                }
            }
        }
    }, updateLocationHandler);
}
