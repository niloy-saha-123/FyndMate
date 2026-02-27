/**
 * @file tests/integration/services/audit.test.ts
 * @description Integration tests for audit service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    logAuditEvent,
    getUserAuditLogs,
    getFailedAuditLogs,
    cleanupOldAuditLogs,
    AuditAction,
} from '../../../src/services/audit.service.js';
import { createDummyUser, clearDatabase } from '../../helpers.js';
import { prisma } from '../../../src/lib/prisma.js';

describe('AuditService', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    /**
     * Should create an audit log entry
     */
    it('creates an audit log entry', async () => {
        const user = await createDummyUser('User');

        const log = await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_UPDATED,
            entity: 'User',
            metadata: { field: 'bio', value: 'New bio' },
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent',
            status: 'SUCCESS',
        });

        expect(log).not.toBeNull();
        expect(log?.userId).toBe(user.id);
        expect(log?.action).toBe(AuditAction.PROFILE_UPDATED);
    });

    /**
     * Should retrieve audit logs for a user
     */
    it('retrieves audit logs for a user', async () => {
        const user = await createDummyUser('User');

        await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_UPDATED,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'SUCCESS',
        });

        const logs = await getUserAuditLogs(user.id);
        expect(logs).toHaveLength(1);
        expect(logs[0].userId).toBe(user.id);
    });

    /**
     * Should filter by action type
     */
    it('filters by action type', async () => {
        const user = await createDummyUser('User');

        await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_UPDATED,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'SUCCESS',
        });

        await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_PICTURE_UPLOAD,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'SUCCESS',
        });

        const logs = await getUserAuditLogs(user.id, {
            action: AuditAction.PROFILE_UPDATED,
        });

        expect(logs).toHaveLength(1);
        expect(logs[0].action).toBe(AuditAction.PROFILE_UPDATED);
    });

    /**
     * Should retrieve failed audit logs
     */
    it('retrieves failed audit logs', async () => {
        const user = await createDummyUser('User');

        await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_PICTURE_UPLOAD,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'FAILED',
            error: 'Upload failed',
        });

        const failedLogs = await getFailedAuditLogs();
        expect(failedLogs.length).toBeGreaterThan(0);
        expect(failedLogs[0].status).toBe('FAILED');
    });

    /**
     * Should filter failed logs by time range (hours)
     */
    it('filters failed logs by time range (hours)', async () => {
        const user = await createDummyUser('User');

        // Create old log
        const oldLog = await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_PICTURE_UPLOAD,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'FAILED',
        });

        // Manually update timestamp to be old
        await prisma.auditLog.update({
            where: { id: oldLog!.id },
            data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }, // 25 hours ago
        });

        const recentFailed = await getFailedAuditLogs({ hours: 24 });
        expect(recentFailed.find((log) => log.id === oldLog!.id)).toBeUndefined();
    });

    /**
     * Should clean up old logs by retention days
     */
    it('cleans up old logs by retention days', async () => {
        const user = await createDummyUser('User');

        const oldLog = await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_UPDATED,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'SUCCESS',
        });

        // Set to 100 days old
        await prisma.auditLog.update({
            where: { id: oldLog!.id },
            data: { createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
        });

        const deletedCount = await cleanupOldAuditLogs(90);
        expect(deletedCount).toBeGreaterThan(0);

        const logAfterCleanup = await prisma.auditLog.findUnique({
            where: { id: oldLog!.id },
        });
        expect(logAfterCleanup).toBeNull();
    });

    /**
     * Should return null on database error (not throw)
    /**
     * Should include user info (email, name) in results
     */
    it('includes user info (email, name) in results', async () => {
        const user = await createDummyUser('TestUser');

        await logAuditEvent({
            userId: user.id,
            action: AuditAction.PROFILE_UPDATED,
            entity: 'User',
            metadata: {},
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            status: 'SUCCESS',
        });

        const logs = await getUserAuditLogs(user.id);
        expect(logs[0]).toHaveProperty('user');
        expect(logs[0].user).toHaveProperty('email');
        expect(logs[0].user).toHaveProperty('name');
    });
});
