/**
 * @file src/lib/prisma.ts
 * @description Prisma client singleton. Provides a single PrismaClient instance
 *              that can be imported anywhere in the codebase. Uses globalThis
 *              pattern to prevent multiple instances during hot-reloading in dev.
 */

import { PrismaClient } from '@prisma/client';
import { assertProductionNonLocalUrl, assertProductionRequired } from './env.js';

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

assertProductionRequired('DATABASE_URL', databaseUrl);
assertProductionNonLocalUrl('DATABASE_URL', databaseUrl);
assertProductionNonLocalUrl('DIRECT_URL', directUrl);

// Extend globalThis to store prisma instance (for hot reload in dev)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create PrismaClient with logging based on environment
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export type { PrismaClient };
