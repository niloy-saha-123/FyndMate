/**
 * @file tests/unit/services/auth-service.test.ts
 * @description Unit tests for auth service name validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signupUser } from '../../../src/services/auth.service.js';

// Mock Supabase admin
vi.mock('../../../src/lib/supabaseAdmin.js', () => ({
    supabaseAdmin: {
        auth: {
            admin: {
                createUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'mock-user-id' } },
                    error: null,
                }),
            },
        },
    },
}));

describe('signupUser - name validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Should reject reserved name 'admin'
     */
    it('rejects admin', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'admin',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject reserved name 'root'
     */
    it('rejects root', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'root',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject reserved name 'null'
     */
    it('rejects null', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'null',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject reserved name 'undefined'
     */
    it('rejects undefined', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'undefined',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject single character name
     */
    it('rejects single char A', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'A',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject name > 40 chars
     */
    it('rejects > 40 chars', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'a'.repeat(41),
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject name with numbers
     */
    it('rejects name with numbers John123', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'John123',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });

    /**
     * Should reject name with special characters
     */
    it('rejects name with special chars John@Doe', async () => {
        await expect(
            signupUser({
                email: 'test@example.com',
                password: 'password123',
                name: 'John@Doe',
            })
        ).rejects.toThrow('Invalid or reserved name');
    });
});
