/**
 * @file src/nonce-store/redis-store.ts
 * @description Redis-based nonce storage (primary implementation)
 */

import { Redis } from 'ioredis';
import { NonceStore } from './types.js';

export class RedisNonceStore implements NonceStore {
    constructor(private redis: Redis) {}

    async isUsed(nonce: string): Promise<boolean> {
        try {
            const key = `nonce:${nonce}`;
            const exists = await this.redis.exists(key);
            return exists === 1;
        } catch (error) {
            throw new Error(`Redis nonce check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async markUsed(nonce: string, ttlSeconds: number): Promise<void> {
        try {
            const key = `nonce:${nonce}`;
            await this.redis.set(key, '1', 'EX', ttlSeconds);
        } catch (error) {
            throw new Error(`Redis nonce mark failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async clear(): Promise<void> {
        try {
            // Use SCAN to find all nonce keys and delete them
            // TODO [5K Users]: Optimize with Lua script for atomic batch deletion
            const keys = await this.redis.keys('nonce:*');
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            throw new Error(`Redis nonce clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
