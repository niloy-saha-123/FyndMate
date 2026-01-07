/**
 * @file server/tests/helpers.ts
 * @description Shared utility functions for testing.
 * 
 * Provides helper methods to:
 * - Create dummy data (Users) with realistic but randomized properties.
 * - Reset the database state between tests to ensure test isolation.
 */
import { prisma } from '../src/lib/prisma.js';
import { randomUUID } from 'crypto';

/**
 * Creates a user with valid default fields (and allows overrides).
 * Used to quickly set up "Me", "Alice", "Bob" scenarios.
 */
export async function createDummyUser(name: string, overrides: any = {}) {
    const id = randomUUID();
    return await prisma.user.create({
        data: {
            id, // Explicit ID to ensure CUID/UUID compatibility if needed
            supabaseId: `supa_${id}`, // Mock Supabase ID
            email: `${name.toLowerCase().replace(/\s/g, '')}_${id.substring(0, 8)}@example.com`,
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
    // Order matters due to foreign keys
    await prisma.message.deleteMany();
    await prisma.match.deleteMany();
    await prisma.like.deleteMany();
    await prisma.block.deleteMany();
    await prisma.user.deleteMany();
}
