/**
 * @file src/nonce-store/memory-store.ts
 * @description In-memory nonce storage as fallback when Redis is unavailable
 * 
 * LIMITATIONS:
 * - Only works on a single server instance
 * - Nonces are lost on server restart (could allow replay attacks across restarts)
 * - Not suitable for multi-server deployments without sticky sessions
 * 
 * TODO [5K Users]: Persist critical nonces to database as backup
 * TODO [10K Users]: Implement distributed nonce store with Redis Cluster
 */

import { NonceStore } from './types.js';

interface NonceEntry {
    expiresAt: number; // Unix timestamp in milliseconds
}

export class InMemoryNonceStore implements NonceStore {
    private store = new Map<string, NonceEntry>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired nonces every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60_000);
        // Do not keep process alive solely for cleanup (use destroy on shutdown)
        this.cleanupInterval.unref();
    }

    async isUsed(nonce: string): Promise<boolean> {
        const entry = this.store.get(nonce);
        
        if (!entry) {
            return false;
        }

        // Check if expired
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(nonce);
            return false;
        }

        return true;
    }

    async markUsed(nonce: string, ttlSeconds: number): Promise<void> {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.store.set(nonce, { expiresAt });
    }

    async clear(): Promise<void> {
        this.store.clear();
    }

    /**
     * Clean up expired nonces to prevent memory leaks
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [nonce, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(nonce);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.info(`[InMemoryNonceStore] Cleaned up ${cleaned} expired nonces`);
        }

        // TODO [2K Users]: Alert if nonce store grows too large (>10K entries)
        if (this.store.size > 10_000) {
            console.warn(`[InMemoryNonceStore] Large nonce store: ${this.store.size} entries`);
        }
    }

    /**
     * Get current store size (for monitoring)
     */
    getStoreSize(): number {
        return this.store.size;
    }

    /**
     * Cleanup on shutdown
     */
    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}
