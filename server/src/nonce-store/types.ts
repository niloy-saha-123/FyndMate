/**
 * @file src/nonce-store/types.ts
 * @description Type definitions for nonce storage system (replay attack prevention)
 */

/**
 * Interface for nonce storage backends
 * Used to prevent replay attacks on location updates
 */
export interface NonceStore {
    /**
     * Check if a nonce has been used
     * @param nonce - Unique nonce string
     * @returns true if nonce was already used, false if fresh
     */
    isUsed(nonce: string): Promise<boolean>;

    /**
     * Mark a nonce as used
     * @param nonce - Unique nonce string
     * @param ttlSeconds - How long to remember this nonce
     */
    markUsed(nonce: string, ttlSeconds: number): Promise<void>;

    /**
     * Clear all nonces (testing/admin purposes)
     */
    clear?(): Promise<void>;
}
