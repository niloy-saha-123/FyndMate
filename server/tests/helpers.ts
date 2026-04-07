/**
 * @file server/tests/helpers.ts
 * @description Shared utility functions for testing.
 *
 * Provides helper methods to:
 * - Create dummy data (Users) with realistic but randomized properties.
 * - Reset the database state between tests to ensure test isolation.
 * - Generate auth tokens for testing protected routes.
 *
 * IMPORTANT: All IDs use UUID (crypto.randomUUID) to match the Prisma schema
 * which defines `@id @default(uuid())` on all models.
 */
import { prisma } from '../src/lib/prisma.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Generates a UUID v4 for test entity IDs.
 * Matches production Prisma schema: @default(uuid())
 */
export function createUUID(): string {
    return crypto.randomUUID();
}

/**
 * Creates a user with valid default fields (and allows overrides).
 * Used to quickly set up "Me", "Alice", "Bob" scenarios.
 *
 * Uses UUID to match the Prisma schema @default(uuid()).
 */
export async function createDummyUser(name: string, overrides: any = {}) {
    const id = createUUID();
    const supabaseId = createUUID();
    const email = `${name.toLowerCase().replace(/\s/g, '')}_${id.substring(0, 8)}@example.com`;

    return await prisma.user.create({
        data: {
            id,
            supabaseId,
            email,
            name,
            location: 'Test City',
            timezone: 'UTC',
            profilePicture: 'https://example.com/pic.jpg',
            ...overrides,
        },
    });
}

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function createLocalSupabaseAdminClient() {
    if (!LOCAL_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in test environment');
    }
    return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
}

function assertLocalTestEnvironment() {
    const dbUrl = process.env.DATABASE_URL || '';
    const supabaseUrl = process.env.SUPABASE_URL || '';

    if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: Tests can only run against local database. ' +
                'DATABASE_URL must contain 127.0.0.1 or localhost. ' +
                `Current: ${dbUrl.substring(0, 30)}...`,
        );
    }

    if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: Tests can only run against local Supabase. ' +
                'SUPABASE_URL must contain 127.0.0.1 or localhost. ' +
                `Current: ${supabaseUrl}`,
        );
    }
}

/**
 * Creates a deterministic authenticated test identity and returns both token and app user row.
 * Use this helper when tests need token-user identity to match seeded data.
 */
export async function createAuthedUser(name = 'Test User') {
    assertLocalTestEnvironment();

    const localSupabase = createLocalSupabaseAdminClient();
    const testEmail = `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
    const testPassword = 'testpass123';

    const { data: userData, error: createError } = await localSupabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
    });

    if (createError || !userData.user) {
        throw new Error(`Failed to create test user: ${createError?.message}`);
    }

    const user = await prisma.user.create({
        data: {
            supabaseId: userData.user.id,
            email: testEmail,
            name,
            profilePicture: 'https://avatar.iran.liara.run/public/42',
            bio: 'Test user for validation tests',
            location: 'Test City',
            timezone: 'UTC',
        },
    });

    const { data: signInData, error: signInError } = await localSupabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
    });

    if (!signInData.session) {
        throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    return {
        token: signInData.session.access_token,
        user,
        supabaseUserId: userData.user.id,
        email: testEmail,
    };
}

/**
 * Deletes all data from the database.
 * MUST be called in `beforeEach` to guarantee a clean slate for every test.
 *
 * Deletion order respects Foreign Key constraints:
 *   Message → MatchNotificationPreference → Match → Like → Block → Report →
 *   UploadSession → AuditLog → Experience → Project → User
 */
export async function clearDatabase() {
    // SAFETY: Prevent production database wipe
    const dbUrl = process.env.DATABASE_URL || '';
    const supabaseUrl = process.env.SUPABASE_URL || '';

    if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: clearDatabase() blocked - DATABASE_URL points to non-local database!\n' +
                `DATABASE_URL: ${dbUrl.substring(0, 50)}...\n` +
                'Tests must only run against local Docker (127.0.0.1 or localhost).',
        );
    }

    if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: clearDatabase() blocked - SUPABASE_URL points to non-local instance!\n' +
                `SUPABASE_URL: ${supabaseUrl}\n` +
                'Tests must only run against local Docker (127.0.0.1 or localhost).',
        );
    }

    // Order matters due to foreign keys
    await prisma.message.deleteMany();
    await prisma.matchNotificationPreference.deleteMany();
    await prisma.match.deleteMany();
    await prisma.like.deleteMany();
    await prisma.block.deleteMany();
    await prisma.report.deleteMany();
    await prisma.uploadSession.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.experience.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Cleanup retention ledger if present (raw table managed outside Prisma schema)
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'deleted_account_retention'
        ) THEN
          DELETE FROM public.deleted_account_retention;
        END IF;
      END
      $$;
    `);
}

/**
 * Generates a valid JWT auth token for testing protected routes.
 *
 * Uses the local Supabase instance to:
 * 1. Create a user in Supabase Auth with a password
 * 2. Create the corresponding user in the database (auth middleware checks this)
 * 3. Sign in to get a real JWT token
 *
 * @param supabaseId - Ignored, we create a fresh user
 * @param email - Ignored, we use a unique test email
 * @returns JWT access token for the Authorization header
 */
export async function getAuthToken(supabaseId: string, email: string): Promise<string> {
    const { token } = await createAuthedUser('Test User');
    return token;
}
