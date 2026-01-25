/**
 * @file src/services/audit.service.ts
 * @description Audit logging service for security and compliance.
 * Records critical user actions for abuse investigation and monitoring.
 */

import { prisma } from '../lib/prisma.js';
import type { FastifyRequest } from 'fastify';

/**
 * Supported audit log actions
 */
export const AuditAction = {
    PROFILE_PICTURE_UPLOAD: 'PROFILE_PICTURE_UPLOAD',
    PROFILE_PICTURE_DELETE: 'PROFILE_PICTURE_DELETE',
    PROFILE_UPDATED: 'PROFILE_UPDATED',
    ACCOUNT_CREATED: 'ACCOUNT_CREATED',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

/**
 * Audit log entry data
 */
export interface AuditLogData {
    userId: string;
    action: AuditActionType;
    entity?: string;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, any>;
    ipAddress?: string | null;
    userAgent?: string | null;
    status: 'SUCCESS' | 'FAILED';
    error?: string | null;
}

/**
 * Log an audit event to the database
 * 
 * @param data - Audit log data
 * @returns Created audit log entry
 * 
 * @example
 * await logAuditEvent({
 *   userId: 'user123',
 *   action: AuditAction.PROFILE_PICTURE_UPLOAD,
 *   oldValue: 'old-url',
 *   newValue: 'new-url',
 *   ipAddress: '1.2.3.4',
 *   status: 'SUCCESS',
 * });
 */
export async function logAuditEvent(data: AuditLogData) {
    try {
        return await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: data.entity || 'profile_picture',
                oldValue: data.oldValue,
                newValue: data.newValue,
                metadata: data.metadata,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                status: data.status,
                error: data.error,
            },
        });
    } catch (error) {
        // Don't fail the request if audit logging fails
        // Just log the error for monitoring
        console.error('Failed to create audit log:', error);
        return null;
    }
}

/**
 * Helper to log upload events from Fastify requests
 * Automatically extracts IP and user agent from request
 * 
 * @param request - Fastify request object
 * @param data - Audit log data (IP and user agent auto-extracted)
 * 
 * @example
 * await logUploadEvent(request, {
 *   userId: request.user!.id,
 *   action: AuditAction.PROFILE_PICTURE_UPLOAD,
 *   oldValue: currentUser?.profilePicture,
 *   newValue: publicUrl,
 *   metadata: { fileSize: 1024000 },
 *   status: 'SUCCESS',
 * });
 */
export async function logUploadEvent(
    request: FastifyRequest,
    data: Omit<AuditLogData, 'ipAddress' | 'userAgent'>
) {
    return logAuditEvent({
        ...data,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
    });
}

/**
 * Get audit logs for a specific user
 * 
 * @param userId - User ID to get logs for
 * @param options - Query options (limit, action filter)
 * @returns Array of audit logs
 * 
 * @example
 * // Get last 50 uploads for a user
 * const logs = await getUserAuditLogs('user123', {
 *   action: AuditAction.PROFILE_PICTURE_UPLOAD,
 *   limit: 50,
 * });
 */
export async function getUserAuditLogs(
    userId: string,
    options?: {
        action?: AuditActionType;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }
) {
    const where: any = { userId };

    if (options?.action) {
        where.action = options.action;
    }

    if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) {
            where.createdAt.gte = options.startDate;
        }
        if (options.endDate) {
            where.createdAt.lte = options.endDate;
        }
    }

    return prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        include: {
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
    });
}

/**
 * Get failed audit logs (for security monitoring)
 * 
 * @param options - Query options
 * @returns Array of failed audit logs
 * 
 * @example
 * // Get all failed uploads in the last 24 hours
 * const failedUploads = await getFailedAuditLogs({
 *   action: AuditAction.PROFILE_PICTURE_UPLOAD,
 *   hours: 24,
 *   limit: 100,
 * });
 */
export async function getFailedAuditLogs(options?: {
    action?: AuditActionType;
    hours?: number;
    limit?: number;
}) {
    const where: any = { status: 'FAILED' };

    if (options?.action) {
        where.action = options.action;
    }

    if (options?.hours) {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - options.hours);
        where.createdAt = { gte: startDate };
    }

    return prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        include: {
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
    });
}

/**
 * Clean up old audit logs (retention policy)
 * Call this from a cron job to keep database size reasonable
 * 
 * @param retentionDays - Number of days to keep logs (default: 90)
 * @returns Number of logs deleted
 * 
 * @example
 * // Delete logs older than 90 days
 * const deleted = await cleanupOldAuditLogs(90);
 * console.log(`Deleted ${deleted} old audit logs`);
 */
export async function cleanupOldAuditLogs(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
        where: {
            createdAt: {
                lt: cutoffDate,
            },
        },
    });

    return result.count;
}
