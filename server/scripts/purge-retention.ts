/**
 * @file scripts/purge-retention.ts
 * @description Scheduled entrypoint for the account-deletion retention purge.
 *
 * Deletes quarantined images and erases the personal fields of
 * `deleted_account_retention` rows whose `retention_ends_at` has passed, which is what
 * enforces the retention window stated in the privacy policy.
 *
 * USAGE:
 * - Local:  npm run purge:retention
 * - Cron/CI: same command, with DATABASE_URL + Supabase service credentials in env.
 *
 * Exits non-zero if any record failed, so a scheduler surfaces the problem. Failed
 * records keep `purged_at = null` and are retried on the next run.
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { purgeExpiredRetentionRecords } from '../src/services/retentionPurge.service.js';

async function main(): Promise<void> {
  const startedAt = Date.now();
  const result = await purgeExpiredRetentionRecords();

  console.info(
    `[retention-purge] examined=${result.examined} purged=${result.purged} ` +
      `filesDeleted=${result.filesDeleted} failed=${result.failures.length} ` +
      `durationMs=${Date.now() - startedAt}`
  );

  for (const failure of result.failures) {
    console.error(`[retention-purge] record ${failure.recordId} failed: ${failure.reason}`);
  }

  if (result.failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[retention-purge] fatal error', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
