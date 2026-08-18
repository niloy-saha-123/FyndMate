/**
 * @file src/services/retentionPurge.service.ts
 * @description Enforces the post-deletion retention window that the privacy policy
 * promises.
 *
 * Account deletion (profile.routes.ts) moves the user's uploaded images into a
 * quarantine prefix and writes a `deleted_account_retention` row carrying
 * `retention_ends_at`. Until this job existed nothing ever read that column, so
 * quarantined images and the retained email address persisted indefinitely -- the
 * stated retention window was not actually enforced anywhere.
 *
 * Running this on a schedule is what makes that claim true.
 */

import { prisma } from '../lib/prisma.js';
import { deleteQuarantinedFiles } from './storage.service.js';

/** Rows handled per invocation, so a large backlog cannot produce an unbounded run. */
const DEFAULT_BATCH_SIZE = 100;

export type RetentionPurgeFailure = {
  recordId: string;
  reason: string;
};

export type RetentionPurgeResult = {
  /** Rows that were due for purging when this run started. */
  examined: number;
  /** Rows successfully purged. */
  purged: number;
  /** Quarantined storage objects removed. */
  filesDeleted: number;
  /** Rows left untouched for the next run to retry. */
  failures: RetentionPurgeFailure[];
};

export type PurgeOptions = {
  batchSize?: number;
  /** Injectable clock so tests can drive the retention boundary directly. */
  now?: Date;
};

/**
 * Purge every retention record whose window has elapsed.
 *
 * Personal data is erased (email, quarantined paths, and the personal fields of
 * metadata) and `purged_at` is stamped, rather than dropping the row outright. That
 * keeps a non-personal audit trail -- that an account was deleted, and when -- which
 * is the stated reason the record exists at all. To hard-delete instead, replace the
 * `update` below with a `delete`.
 *
 * Safe to run concurrently with itself and safe to retry: a record is only marked
 * purged after its files are gone, and removing an already-deleted object is a no-op.
 */
export async function purgeExpiredRetentionRecords(
  options: PurgeOptions = {}
): Promise<RetentionPurgeResult> {
  const { batchSize = DEFAULT_BATCH_SIZE, now = new Date() } = options;

  const due = await prisma.deleted_account_retention.findMany({
    where: {
      purged_at: null,
      retention_ends_at: { lte: now },
    },
    orderBy: { retention_ends_at: 'asc' },
    take: batchSize,
  });

  const result: RetentionPurgeResult = {
    examined: due.length,
    purged: 0,
    filesDeleted: 0,
    failures: [],
  };

  for (const record of due) {
    const paths = record.quarantined_file_paths ?? [];

    try {
      // Storage first. If the process dies between these two steps the row still has
      // purged_at = null, so the next run retries it. Doing it the other way round
      // would strand files with no surviving pointer to them.
      const { failed } = await deleteQuarantinedFiles(paths);

      if (failed.length > 0) {
        result.failures.push({
          recordId: record.id,
          reason: `storage: ${failed.map((f) => f.reason).join('; ')}`,
        });
        continue;
      }

      const existingMetadata =
        record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : {};

      // Narrowed to a string rather than passed through as `unknown`, so the
      // redacted metadata is guaranteed to be JSON-safe.
      const deletedBy =
        typeof existingMetadata.deletedBy === 'string' ? existingMetadata.deletedBy : null;

      await prisma.deleted_account_retention.update({
        where: { id: record.id },
        data: {
          email: null,
          quarantined_file_paths: [],
          // Keep only the non-personal audit fact of who initiated the deletion.
          metadata: {
            deletedBy,
            purgedBy: 'retention-job',
          },
          purged_at: new Date(),
        },
      });

      result.purged += 1;
      result.filesDeleted += paths.length;
    } catch (error: any) {
      result.failures.push({
        recordId: record.id,
        reason: error?.message ?? String(error),
      });
    }
  }

  return result;
}
