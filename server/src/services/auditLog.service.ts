/**
 * @file src/services/auditLog.service.ts
 * @description Specialized audit logging for location and profile view events.
 * Used for detecting suspicious activity patterns and compliance tracking.
 */

import { prisma } from '../lib/prisma.js';

export enum AuditAction {
    LOCATION_UPDATE = 'LOCATION_UPDATE',
    LOCATION_VIEW = 'LOCATION_VIEW',
    LOCATION_PREFERENCE_CHANGE = 'LOCATION_PREFERENCE_CHANGE',
    PROFILE_VIEW = 'PROFILE_VIEW',
}

interface AuditLogData {
    userId: string;
    action: AuditAction;
    targetUserId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Create an audit log entry.
 * 
 * @param data - Audit log data
 * 
 * @example
 * // Log when someone updates their location
 * await auditLog({
 *   userId: req.user.id,
 *   action: AuditAction.LOCATION_UPDATE,
 *   metadata: { city: 'San Francisco', country: 'USA' },
 *   ipAddress: req.ip,
 * });
 */
export async function auditLog(data: AuditLogData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: 'location',
                status: 'success',
                metadata: data.metadata || {},
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    } catch (error) {
        // Don't fail the request if audit logging fails
        // But log the error for monitoring
        console.error('Failed to create audit log:', error);
    }
}

/**
 * Get audit logs for a specific user.
 * Useful for showing users "Your location history" in settings.
 * 
 * @param userId - User ID to get logs for
 * @param limit - Maximum number of logs to return
 * @returns Array of audit logs
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            action: true,
            metadata: true,
            ipAddress: true,
            createdAt: true,
            // Don't expose userAgent (can contain sensitive info)
        },
    });
}

/**
 * Detect suspicious activity patterns.
 * 
 * @param userId - User ID to check
 * @returns True if suspicious activity detected
 * 
 * @example
 * if (await detectSuspiciousActivity(userId)) {
 *   // Alert security team, rate limit user, etc.
 * }
 */
export async function detectSuspiciousActivity(userId: string): Promise<boolean> {
    // Check if user has viewed > 100 profiles in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentViews = await prisma.auditLog.count({
        where: {
            userId,
            action: AuditAction.PROFILE_VIEW,
            createdAt: { gte: oneHourAgo },
        },
    });

    // Threshold: 100 profile views per hour is suspicious
    // (Normal users view ~10-20 profiles per session)
    return recentViews > 100;
}
