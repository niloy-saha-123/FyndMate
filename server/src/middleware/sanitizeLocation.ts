/**
 * @file src/middleware/sanitizeLocation.ts
 * @description Middleware to strip sensitive location data from API responses.
 * Ensures fields like latitude/longitude are never exposed to the client.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * List of sensitive fields that should NEVER be exposed to clients.
 * 
 * CURRENT FIELDS (implemented):
 * - latitude: User's actual GPS latitude
 * - longitude: User's actual GPS longitude  
 * - locationSecret: HMAC secret for location update validation
 * 
 * TODO [PREMIUM FEATURE]: When implementing radius-based matching, add:
 * - searchLatitude: User's search center latitude
 * - searchLongitude: User's search center longitude
 * These fields are used for internal distance calculations ONLY.
 * They must NEVER be exposed in API responses.
 */
const SENSITIVE_LOCATION_FIELDS = [
    'latitude',
    'longitude',
    'locationSecret',
    // TODO [PREMIUM]: Uncomment when fields are added to schema:
    // 'searchLatitude',
    // 'searchLongitude',
] as const;

/**
 * Recursively sanitize an object by removing sensitive location fields.
 * 
 * @param obj - Object to sanitize (can be nested)
 * @returns Sanitized object with sensitive fields removed
 */
function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }

    // Handle objects
    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
            // Skip sensitive fields
    if (SENSITIVE_LOCATION_FIELDS.includes(key as any)) { // TODO [POST-MVP]: unify with locationPrivacy.ts and remove as any.
                continue;
            }
            // Recursively sanitize nested objects
            sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }

    // Return primitives as-is
    return obj;
}

/**
 * Fastify hook to sanitize response payloads.
 * 
 * This runs AFTER our route handler but BEFORE sending the response to the client.
 * It strips out any sensitive location fields from the response.
 * 
 * Usage:
 * Add to app.ts:
 * ```typescript
 * app.addHook('onSend', sanitizeLocationResponse);
 * ```
 */
export async function sanitizeLocationResponse(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: any
): Promise<any> {
    // Only sanitize JSON responses
    const contentType = reply.getHeader('content-type');
    if (typeof contentType === 'string' && contentType.includes('application/json')) {
        try {
            let data: any;

            // Handle different payload types (Fastify can send string, Buffer, or object)
            if (typeof payload === 'string') {
                // Already stringified JSON
                data = JSON.parse(payload);
            } else if (Buffer.isBuffer(payload)) {
                // Buffer (convert to string first)
                data = JSON.parse(payload.toString('utf-8'));
            } else if (typeof payload === 'object' && payload !== null) {
                // Plain object (not yet serialized)
                data = payload;
            } else {
                // Unknown type, return as-is
                return payload;
            }

            // Sanitize the data
            const sanitized = sanitizeObject(data);

            // Return in the same format as input
            return typeof payload === 'string' || Buffer.isBuffer(payload)
                ? JSON.stringify(sanitized)  // Return as string if input was string/Buffer
                : sanitized;                  // Return as object if input was object
        } catch (error) {
            // CRITICAL SECURITY: Fail-closed on sanitization error
            // Never return unsanitized data with potential lat/long/locationSecret exposure
            request.log.error({ 
                error, 
                payloadType: typeof payload,
                route: request.url,
                method: request.method
            }, '🚨 CRITICAL: Failed to sanitize location response - failing closed');
            
            // Fail closed without double-sending: set status and return safe payload
            reply.status(500);
            return {
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' 
                    ? 'Response sanitization failed' 
                    : undefined
            };
        }
    }

    return payload;
}

/**
 * Helper function to manually sanitize a user object.
 * Use this when we want to explicitly sanitize before sending.
 * 
 * @param user - User object to sanitize
 * @returns Sanitized user object
 * 
 * @example
 * const user = await prisma.user.findUnique({ where: { id } });
 * const safeUser = sanitizeUserLocation(user);
 * return reply.send(safeUser);
 */
export function sanitizeUserLocation<T extends Record<string, any>>(user: T): T {
    return sanitizeObject(user);
}
