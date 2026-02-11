/**
 * @file tests/unit/nonce-store/memory-store.test.ts
 * @description Unit tests for in-memory nonce store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryNonceStore } from '../../../src/nonce-store/memory-store.js';

describe('InMemoryNonceStore', () => {
    let store: InMemoryNonceStore;

    beforeEach(() => {
        store = new InMemoryNonceStore();
    });

    afterEach(() => {
        store.destroy();
        vi.useRealTimers();
    });

    /**
     * Should return false for unused nonce
     */
    it('unused nonce returns false from isUsed', async () => {
        const result = await store.isUsed('nonce-123');
        expect(result).toBe(false);
    });

    /**
     * Should return true after markUsed
     */
    it('after markUsed, isUsed returns true', async () => {
        await store.markUsed('nonce-456', 60);
        const result = await store.isUsed('nonce-456');
        expect(result).toBe(true);
    });

    /**
     * Should return false for expired nonce
     */
    it('expired nonce returns false from isUsed', async () => {
        vi.useFakeTimers();

        await store.markUsed('nonce-789', 5);

        // Advance time by 6 seconds (beyond TTL)
        vi.advanceTimersByTime(6000);

        const result = await store.isUsed('nonce-789');
        expect(result).toBe(false);
    });

    /**
     * Should remove all nonces on clear
     */
    it('clear() removes all nonces', async () => {
        await store.markUsed('nonce-1', 60);
        await store.markUsed('nonce-2', 60);

        await store.clear();

        expect(await store.isUsed('nonce-1')).toBe(false);
        expect(await store.isUsed('nonce-2')).toBe(false);
    });

    /**
     * Should return correct store size
     */
    it('getStoreSize() returns correct count', async () => {
        await store.markUsed('nonce-a', 60);
        await store.markUsed('nonce-b', 60);
        await store.markUsed('nonce-c', 60);

        const size = store.getStoreSize();
        expect(size).toBe(3);
    });
});
