/**
 * @file src/middleware/sanitizeLocation.ts
 * @description Middleware to sanitize location data in API responses.
 * 
 * SECURITY PURPOSE:
 * This middleware ensures that sensitive location fields (latitude, longitude, locationSecret)
 * are NEVER exposed in API responses, even if a developer accidentally selects them.
 * 
 * This is a defense-in-depth measure - even if someone makes a mistake in the code,
 * this middleware will strip sensitive fields before sending to the client.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * List of sensitive fields that should NEVER be exposed to clients.
 */
const SENSITIVE_LOCATION_FIELDS = [
    'latitude',
    'longitude',
    'locationSecret',
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
            if (SENSITIVE_LOCATION_FIELDS.includes(key as any)) {
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
 * This runs AFTER your route handler but BEFORE sending the response to the client.
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
            const data = JSON.parse(payload);
            const sanitized = sanitizeObject(data);
            return JSON.stringify(sanitized);
        } catch (error) {
            // If parsing fails, return original payload
            request.log.error(error, 'Failed to sanitize location response');
            return payload;
        }
    }

    return payload;
}

/**
 * Helper function to manually sanitize a user object.
 * Use this when you want to explicitly sanitize before sending.
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
