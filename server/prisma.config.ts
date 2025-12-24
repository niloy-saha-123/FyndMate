/**
 * @file prisma.config.ts
 * @description Prisma CLI configuration file (Prisma 7+). Defines schema location,
 *              migration paths, seed script, and database connection URLs.
 *              This file is read by Prisma CLI commands like `prisma migrate` and
 *              `prisma db push`. The datasource URL is configured here, NOT in schema.prisma.
 */

import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});

