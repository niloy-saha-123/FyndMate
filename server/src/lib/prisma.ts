/**
 * @file src/lib/prisma.ts
 * @description Prisma client singleton. Provides a single PrismaClient instance
 *              that can be imported anywhere in the codebase. Uses globalThis
 *              pattern to prevent multiple instances during hot-reloading in dev.
 *              Configured with PrismaPg adapter for PostgreSQL (Prisma 7 requirement).
 */

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Extend globalThis to store prisma instance (for hot reload in dev)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create PostgreSQL adapter (Prisma 7 requires driver adapters)
const adapter = new PrismaPg({
  connectionString,
  max: 10,
});

// Create PrismaClient with logging based on environment
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export type { PrismaClient };

