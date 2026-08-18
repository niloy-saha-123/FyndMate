/**
 * @file tests/unit/services/retentionPurge.service.test.ts
 * @description Unit tests for the account-deletion retention purge, which enforces
 * the retention window stated in the privacy policy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock('../../../src/lib/prisma.js', () => ({
    prisma: {
        deleted_account_retention: {
            findMany: (...args: unknown[]) => findMany(...args),
            update: (...args: unknown[]) => update(...args),
        },
    },
}));

vi.mock('../../../src/lib/supabaseAdmin.js', () => ({
    supabaseAdmin: {
        storage: {
            from: () => ({ remove: (...args: unknown[]) => remove(...args) }),
        },
    },
}));

const { purgeExpiredRetentionRecords } = await import(
    '../../../src/services/retentionPurge.service.js'
);

function record(overrides: Record<string, unknown> = {}) {
    return {
        id: 'rec-1',
        user_id: 'user-1',
        supabase_id: 'sb-1',
        email: 'deleted@example.com',
        deleted_at: new Date('2026-08-01T00:00:00Z'),
        retention_ends_at: new Date('2026-08-15T00:00:00Z'),
        quarantined_file_paths: ['deleted-accounts/ref/1-user-1__a.jpg'],
        metadata: { deletedBy: 'self', locationSharing: true },
        purged_at: null,
        ...overrides,
    };
}

describe('purgeExpiredRetentionRecords', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        remove.mockResolvedValue({ error: null });
        update.mockResolvedValue({});
    });

    /**
     * Only rows past their window and not already purged should be selected.
     */
    it('queries only unpurged records whose retention window has elapsed', async () => {
        findMany.mockResolvedValue([]);
        const now = new Date('2026-08-20T00:00:00Z');

        await purgeExpiredRetentionRecords({ now });

        const where = findMany.mock.calls[0][0].where;
        expect(where.purged_at).toBeNull();
        expect(where.retention_ends_at).toEqual({ lte: now });
    });

    /**
     * The whole point of the job: quarantined images are actually removed.
     */
    it('deletes quarantined files and stamps purged_at', async () => {
        findMany.mockResolvedValue([record()]);

        const result = await purgeExpiredRetentionRecords();

        expect(remove).toHaveBeenCalledWith(['deleted-accounts/ref/1-user-1__a.jpg']);
        expect(result.purged).toBe(1);
        expect(result.filesDeleted).toBe(1);
        expect(update.mock.calls[0][0].data.purged_at).toBeInstanceOf(Date);
    });

    /**
     * Personal data must not survive the retention window.
     */
    it('erases the retained email and file paths', async () => {
        findMany.mockResolvedValue([record()]);

        await purgeExpiredRetentionRecords();

        const data = update.mock.calls[0][0].data;
        expect(data.email).toBeNull();
        expect(data.quarantined_file_paths).toEqual([]);
        // Personal metadata is dropped; the non-personal audit fact is kept.
        expect(data.metadata).toEqual({ deletedBy: 'self', purgedBy: 'retention-job' });
        expect(data.metadata).not.toHaveProperty('locationSharing');
    });

    /**
     * A storage failure must not mark the record purged, or the files become
     * unreachable orphans with nothing pointing at them.
     */
    it('leaves the record unpurged when storage deletion fails', async () => {
        findMany.mockResolvedValue([record()]);
        remove.mockResolvedValue({ error: { message: 'bucket unavailable' } });

        const result = await purgeExpiredRetentionRecords();

        expect(update).not.toHaveBeenCalled();
        expect(result.purged).toBe(0);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].reason).toContain('bucket unavailable');
    });

    /**
     * One bad record must not abort the batch.
     */
    it('continues past a failing record and still purges the rest', async () => {
        findMany.mockResolvedValue([record({ id: 'bad' }), record({ id: 'good' })]);
        remove
            .mockResolvedValueOnce({ error: { message: 'transient' } })
            .mockResolvedValueOnce({ error: null });

        const result = await purgeExpiredRetentionRecords();

        expect(result.purged).toBe(1);
        expect(result.failures).toHaveLength(1);
        expect(update.mock.calls[0][0].where).toEqual({ id: 'good' });
    });

    /**
     * A record with no quarantined files still needs its email erased.
     */
    it('purges a record that has no quarantined files', async () => {
        findMany.mockResolvedValue([record({ quarantined_file_paths: [] })]);

        const result = await purgeExpiredRetentionRecords();

        expect(remove).not.toHaveBeenCalled();
        expect(result.purged).toBe(1);
        expect(result.filesDeleted).toBe(0);
        expect(update.mock.calls[0][0].data.email).toBeNull();
    });

    /**
     * Batch size must be passed through so a backlog cannot produce an unbounded run.
     */
    it('applies the batch size limit', async () => {
        findMany.mockResolvedValue([]);

        await purgeExpiredRetentionRecords({ batchSize: 25 });

        expect(findMany.mock.calls[0][0].take).toBe(25);
    });
});
