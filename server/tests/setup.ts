/**
 * @file server/tests/setup.ts
 * @description Global Test Setup Configuration for Vitest.
 * 
 * RESPONSIBILITIES:
 * 1. Initializes the Prisma Client singleton to be used across all tests.
 * 2. Handles global lifecycle hooks (beforeAll, afterAll) to ensure proper connection management.
 * 3. Ensures database connections are closed cleanly after the test suite finishes.
 */
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll } from 'vitest';

export const prisma = new PrismaClient();

beforeAll(async () => {
    // Optional: Global setup
});

afterAll(async () => {
    await prisma.$disconnect();
});
