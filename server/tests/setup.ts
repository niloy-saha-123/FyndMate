/**
 * @file server/tests/setup.ts
 * @description Global Test Setup Configuration for Vitest.
 *
 * RESPONSIBILITIES:
 * 1. Validates that tests are running against local database (never production).
 * 2. Initializes the Prisma Client singleton used across all tests.
 * 3. Handles global lifecycle hooks (beforeAll, afterAll) for connection management.
 * 4. Cleans up Redis test data after the suite finishes.
 */
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll } from 'vitest';
import { redis } from '../src/lib/redis.js';

export const prisma = new PrismaClient();

beforeAll(async () => {
    // SAFETY: Abort test suite if not pointing at local database
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
        throw new Error(
            'Tests must only run against local database. ' +
                'Set DATABASE_URL to point to 127.0.0.1 or localhost.',
        );
    }
});

afterAll(async () => {
    // Clean up Redis test data
    try {
        await redis.flushdb();
        await redis.quit();
    } catch {
        // Redis may not be available in all test environments
    }
    await prisma.$disconnect();
});
