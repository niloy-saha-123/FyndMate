/**
 * Quick inspection script to print user counts and basic fields.
 * Usage: npx tsx scripts/inspect_users.ts
 * WARNING: Intended for local development only.
 */
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(process.cwd(), '.env') });

const DB_URL = process.env.DATABASE_URL || '';
const IS_LOCAL = DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1');

if (!IS_LOCAL) {
  console.error('\nSAFETY ERROR: This script is for LOCAL DEVELOPMENT ONLY.');
  console.error(`Your DATABASE_URL: ${DB_URL}`);
  process.exit(1);
}

import { prisma } from '../src/lib/prisma.js';

async function main() {
  const total = await prisma.user.count();
  const withPicture = await prisma.user.count({ where: { profilePicture: { not: null } } });
  const withoutPicture = total - withPicture;
  const banned = await prisma.user.count({ where: { banned: true } });
  const recent = await prisma.user.findMany({ take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, profilePicture: true, banned: true } });

  console.log('Users summary:');
  console.log(`  total: ${total}`);
  console.log(`  with profilePicture: ${withPicture}`);
  console.log(`  without profilePicture: ${withoutPicture}`);
  console.log(`  banned: ${banned}`);
  console.log('\nRecent users (most recent 20):');
  recent.forEach(u => {
    console.log(`  - ${u.name} | id=${u.id} | picture=${u.profilePicture ? 'yes' : 'no'} | banned=${u.banned}`);
  });

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Inspect failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
