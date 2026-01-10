/**
 * @file server/tests/helpers.ts
 * @description Shared utility functions for testing.
 * 
 * Provides helper methods to:
 * - Create dummy data (Users) with realistic but randomized properties.
 * - Reset the database state between tests to ensure test isolation.
 * - Generate auth tokens for testing protected routes.
 */
import { prisma } from '../src/lib/prisma.js';
import { createClient } from '@supabase/supabase-js';
import cuid from 'cuid';

/**
 * Creates a user with valid default fields (and allows overrides).
 * Used to quickly set up "Me", "Alice", "Bob" scenarios.
 * 
 * IMPORTANT: Uses CUID (not UUID) to match production behavior.
 */
export async function createDummyUser(name: string, overrides: any = {}) {
    const id = cuid();  // ✅ CUID matches production
    const supabaseId = `supa_${id.substring(0, 20)}`;  // Shorten for Supabase ID
    const email = `${name.toLowerCase().replace(/\s/g, '')}_${id.substring(0, 8)}@example.com`;

    return await prisma.user.create({
        data: {
            id, // Explicit ID to ensure CUID/UUID compatibility if needed
            supabaseId, // Mock Supabase ID
            email,
            name,
            location: "Test City",
            timezone: "UTC",
            profilePicture: "https://example.com/pic.jpg",
            ...overrides
        }
    });
}

/**
 * Deletes all data from the database.
 * MUST be called in `beforeEach` to guarantee a clean slate for every test.
 * Deletion order respects Foreign Key constraints.
 */
export async function clearDatabase() {
    // SAFETY: Prevent production database wipe
    const dbUrl = process.env.DATABASE_URL || '';
    const supabaseUrl = process.env.SUPABASE_URL || '';

    if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: clearDatabase() blocked - DATABASE_URL points to non-local database!\n' +
            `DATABASE_URL: ${dbUrl.substring(0, 50)}...\n` +
            'Tests must only run against local Docker (127.0.0.1 or localhost).'
        );
    }

    if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: clearDatabase() blocked - SUPABASE_URL points to non-local instance!\n' +
            `SUPABASE_URL: ${supabaseUrl}\n` +
            'Tests must only run against local Docker (127.0.0.1 or localhost).'
        );
    }

    // Order matters due to foreign keys
    await prisma.message.deleteMany();
    await prisma.match.deleteMany();
    await prisma.like.deleteMany();
    await prisma.block.deleteMany();
    await prisma.user.deleteMany();
}

/**
 * Generates a valid JWT auth token for testing protected routes.
 * 
 * Uses the same approach as scripts/get_test_token.ts:
 * 1. Creates user in local Supabase Auth with password
 * 2. Signs in to get real JWT token
 * 3. Token works with auth middleware
 * 
 * @param supabaseId - Ignored, we create fresh user
 * @param email - Ignored, we use unique test email
 * @returns JWT access token that can be used in Authorization header
 */
export async function getAuthToken(supabaseId: string, email: string): Promise<string> {
    // SAFETY: Prevent running tests against production database
    const dbUrl = process.env.DATABASE_URL || '';
    const supabaseUrl = process.env.SUPABASE_URL || '';

    if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: Tests can only run against local database. ' +
            'DATABASE_URL must contain 127.0.0.1 or localhost. ' +
            `Current: ${dbUrl.substring(0, 30)}...`
        );
    }

    if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
        throw new Error(
            '🚨 SECURITY: Tests can only run against local Supabase. ' +
            'SUPABASE_URL must contain 127.0.0.1 or localhost. ' +
            `Current: ${supabaseUrl}`
        );
    }

    // Use local Supabase (same as get_test_token.ts)
    const localSupabase = createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    );

    // Create unique test user
    const testEmail = `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
    const testPassword = 'testpass123';

    // Create user in Supabase Auth
    const { data: userData, error: createError } = await localSupabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
    });

    if (createError || !userData.user) {
        throw new Error(`Failed to create test user: ${createError?.message}`);
    }

    const supabaseUserId = userData.user.id;

    // Create user in database (CRITICAL - auth middleware checks this!)
    await prisma.user.create({
        data: {
            supabaseId: supabaseUserId,
            email: testEmail,
            name: 'Test User',
            profilePicture: 'https://avatar.iran.liara.run/public/42',
            bio: 'Test user for validation tests',
            location: 'Test City',
            timezone: 'UTC',
        }
    });

    // Sign in to get JWT token (same as get_test_token.ts)
    const { data: signInData, error: signInError } = await localSupabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
    });

    if (!signInData.session) {
        throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    // Return the access token
    return signInData.session.access_token;
}

