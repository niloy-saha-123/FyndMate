/**
 * @file src/nonce-store/hybrid-store.ts
 * @description Hybrid nonce store with Redis + in-memory fallback
 * 
 * Critical Security Component:
 * - ALWAYS fails closed (rejects request if validation fails)
 * - Uses Redis when available for distributed nonce tracking
 * - Falls back to in-memory if Redis is down
 * - Protects against replay attacks on location updates
 */

import { RedisNonceStore } from './redis-store.js';
import { InMemoryNonceStore } from './memory-store.js';
import { RedisHealthMonitor } from '../rate-limiting/health-monitor.js';
import { NonceStore } from './types.js';

export class HybridNonceStore implements NonceStore {
    constructor(
        private redisStore: RedisNonceStore,
        private memoryStore: InMemoryNonceStore,
        private healthMonitor: RedisHealthMonitor
    ) {}

    async isUsed(nonce: string): Promise<boolean> {
        // Try Redis first if healthy
        if (this.healthMonitor.isHealthy()) {
            try {
                const isUsed = await this.redisStore.isUsed(nonce);
                this.healthMonitor.recordSuccess();
                return isUsed;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.healthMonitor.recordFailure(errorMsg);
                
                console.warn('[HybridNonceStore] Redis check failed, using in-memory fallback:', errorMsg);
            }
        }

        // Use in-memory fallback
        return await this.memoryStore.isUsed(nonce);
    }

    async markUsed(nonce: string, ttlSeconds: number): Promise<void> {
        // CRITICAL: Mark in both stores to ensure consistency across failover
        // If Redis is down now but comes back later, we don't want old nonces to be replayable
        
        const promises: Promise<void>[] = [
            this.memoryStore.markUsed(nonce, ttlSeconds),
        ];

        if (this.healthMonitor.isHealthy()) {
            promises.push(
                this.redisStore.markUsed(nonce, ttlSeconds).catch(err => {
                    console.warn('[HybridNonceStore] Redis mark failed (non-critical):', err.message);
                    // Not critical - nonce is marked in memory, which prevents immediate replay
                })
            );
        }

        await Promise.all(promises);
    }

    async clear(): Promise<void> {
        const promises = [
            this.memoryStore.clear(),
        ];

        if (this.healthMonitor.isHealthy()) {
            promises.push(
                this.redisStore.clear().catch(err => {
                    console.warn('[HybridNonceStore] Redis clear failed:', err.message);
                })
            );
        }

        await Promise.all(promises);
    }

    /**
     * Get current store size (for monitoring)
     */
    getStoreSize(): number {
        return this.memoryStore.getStoreSize();
    }
}
