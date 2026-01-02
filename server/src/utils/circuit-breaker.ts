/**
 * @file src/utils/circuit-breaker.ts
 * @description Circuit Breaker Pattern for Supabase Storage Health Checking
 * 
 * ============================================
 * WHAT IS THIS?
 * ============================================
 * A circuit breaker protects our app when external services (like Supabase) fail.
 * 
 * ============================================
 * THE PROBLEM IT SOLVES
 * ============================================
 * Without a circuit breaker:
 * 1. Supabase Storage goes down
 * 2. Every user request tries to connect to Supabase
 * 3. Each request waits 30+ seconds before timing out
 * 4. Server gets overwhelmed with hanging requests
 * 5. Our entire app becomes unresponsive (cascading failure)
 * 6. Users think our app is broken
 * 
 * With a circuit breaker:
 * 1. Supabase Storage goes down
 * 2. First 3 requests fail (detected quickly)
 * 3. Circuit "opens" - stops sending requests to Supabase
 * 4. All subsequent requests fail immediately with clear error
 * 5. Server stays healthy, users get instant feedback
 * 6. After 30 seconds, automatically tests if Supabase is back
 * 7. If Supabase recovered, resumes normal operation
 * 
 * ============================================
 * WHERE IS THIS USED?
 * ============================================
 * Currently wraps ALL Supabase Storage operations in:
 * - src/services/storage.service.ts
 *   - createSignedUploadUrl() - Generating upload URLs
 *   - (Future: validateUploadedFile, getPublicUrl, deleteFile)
 * 
 * Usage example:
 *   const result = await withCircuitBreaker(
 *     'createSignedUploadUrl',
 *     async () => await supabase.storage.createSignedUploadUrl(path)
 *   );
 * 
 * ============================================
 * HOW IT WORKS (3 States)
 * ============================================
 * CLOSED (Normal):
 *   - All requests go through to Supabase
 *   - Circuit is healthy
 * 
 * OPEN (Failing):
 *   - After 3 consecutive failures, circuit opens
 *   - All requests rejected immediately (no Supabase calls)
 *   - Error: "Service temporarily unavailable"
 *   - Waits 30 seconds before trying again
 * 
 * HALF_OPEN (Testing):
 *   - After 30s timeout, allows ONE test request
 *   - If succeeds → Back to CLOSED (resume normal)
 *   - If fails → Back to OPEN (wait another 30s)
 * 
 * ============================================
 * CONFIGURATION
 * ============================================
 * - failureThreshold: 3 failures → Open circuit
 * - successThreshold: 2 successes → Close circuit
 * - timeout: 30 seconds before retry
 * 
 * Adjust these based on our needs (see constructor below)
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
    failureThreshold: number;    // Open circuit after N failures
    successThreshold: number;    // Close circuit after N successes
    timeout: number;             // How long to wait before trying again (ms)
}

class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private successCount: number = 0;
    private nextAttempt: number = Date.now();
    private config: CircuitBreakerConfig;

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = {
            failureThreshold: 3,      // Open after 3 failures
            successThreshold: 2,      // Close after 2 successes
            timeout: 30000,           // Wait 30 seconds before retry
            ...config,
        };
    }

    /**
     * Check if circuit allows request
     */
    canRequest(): boolean {
        if (this.state === 'CLOSED') {
            return true;
        }

        if (this.state === 'OPEN') {
            // Check if timeout expired
            if (Date.now() >= this.nextAttempt) {
                this.state = 'HALF_OPEN';
                return true;
            }
            return false; // Circuit still open
        }

        // HALF_OPEN: Allow one request to test
        return true;
    }

    /**
     * Record successful request
     */
    recordSuccess(): void {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.state = 'CLOSED';
                this.successCount = 0;
            }
        }
    }

    /**
     * Record failed request
     */
    recordFailure(): void {
        this.failureCount++;
        this.successCount = 0;

        if (this.failureCount >= this.config.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.config.timeout;
        }
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get failure count
     */
    getFailureCount(): number {
        return this.failureCount;
    }
}

// Singleton instance for Supabase Storage
export const supabaseStorageCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,    // Open circuit after 3 Supabase failures
    successThreshold: 2,    // Close circuit after 2 successes
    timeout: 30000,         // Wait 30 seconds before retrying
});

/**
 * Wrap Supabase call with circuit breaker
 * 
 * @example
 * const result = await withCircuitBreaker(
 *   'upload',
 *   async () => await supabase.storage.from('bucket').upload(...)
 * );
 */
export async function withCircuitBreaker<T>(
    operation: string,
    fn: () => Promise<T>
): Promise<T> {
    // Check if circuit allows request
    if (!supabaseStorageCircuitBreaker.canRequest()) {
        const state = supabaseStorageCircuitBreaker.getState();
        const failures = supabaseStorageCircuitBreaker.getFailureCount();

        throw new Error(
            `Supabase circuit breaker is ${state}. ` +
            `Service temporarily unavailable after ${failures} failures. ` +
            `Please try again in a moment.`
        );
    }

    try {
        const result = await fn();
        supabaseStorageCircuitBreaker.recordSuccess();
        return result;
    } catch (error) {
        supabaseStorageCircuitBreaker.recordFailure();
        throw error;
    }
}
