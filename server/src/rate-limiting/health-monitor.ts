/**
 * @file src/rate-limiting/health-monitor.ts
 * @description Monitors Redis health and manages failover decisions
 * 
 * Periodically checks Redis availability and tracks failure patterns.
 * Used by HybridRateLimiter to decide between Redis and in-memory fallback.
 */

import { Redis } from 'ioredis';
import { HealthStatus } from './types.js';

export class RedisHealthMonitor {
    private status: HealthStatus = {
        healthy: true,
        consecutiveFailures: 0,
        lastChecked: new Date(),
    };
    
    private checkInterval?: NodeJS.Timeout;
    private readonly FAILURE_THRESHOLD = 3; // Mark unhealthy after 3 consecutive failures
    private readonly CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds

    constructor(private redis: Redis) {}

    /**
     * Start background health monitoring
     */
    startMonitoring(): void {
        // Initial health check
        this.performHealthCheck().catch(() => {
            // Ignore initial check failure
        });

        // Periodic checks
        this.checkInterval = setInterval(() => {
            this.performHealthCheck().catch(() => {
                // Errors are logged in performHealthCheck
            });
        }, this.CHECK_INTERVAL_MS);
        // Do not keep process alive solely for health checks (tests/CLI)
        this.checkInterval.unref();

        console.info('[RedisHealthMonitor] Started monitoring Redis health');
    }

    /**
     * Stop background monitoring
     */
    stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
        console.info('[RedisHealthMonitor] Stopped monitoring Redis health');
    }

    /**
     * Check if Redis is currently healthy
     */
    isHealthy(): boolean {
        return this.status.healthy;
    }

    /**
     * Get current health status
     */
    getStatus(): HealthStatus {
        return { ...this.status };
    }

    /**
     * Record a failure from external source (e.g., rate limiter operation failed)
     */
    recordFailure(error?: string): void {
        this.status.consecutiveFailures++;
        this.status.lastError = error;
        this.status.lastChecked = new Date();

        if (this.status.consecutiveFailures >= this.FAILURE_THRESHOLD) {
            this.markUnhealthy();
        }
    }

    /**
     * Record a success from external source
     */
    recordSuccess(): void {
        if (this.status.consecutiveFailures > 0 || !this.status.healthy) {
            console.info('[RedisHealthMonitor] Redis recovered');
        }
        
        this.status.healthy = true;
        this.status.consecutiveFailures = 0;
        this.status.lastError = undefined;
        this.status.lastChecked = new Date();
    }

    /**
     * Perform a health check by pinging Redis
     */
    private async performHealthCheck(): Promise<void> {
        try {
            await this.redis.ping();
            this.recordSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.recordFailure(errorMessage);
            
            console.error('[RedisHealthMonitor] Health check failed:', {
                error: errorMessage,
                consecutiveFailures: this.status.consecutiveFailures,
                threshold: this.FAILURE_THRESHOLD,
            });
        }
    }

    /**
     * Mark Redis as unhealthy and trigger alerts
     */
    private markUnhealthy(): void {
        if (this.status.healthy) {
            this.status.healthy = false;
            
            console.error('🚨 [RedisHealthMonitor] Redis marked as UNHEALTHY after', 
                this.status.consecutiveFailures, 'consecutive failures');
            console.error('   - Rate limiting will use in-memory fallback');
            console.error('   - Caching disabled (slower performance)');
            console.error('   - Last error:', this.status.lastError);
            
            // TODO [1K Users]: Send alert to team (Slack, PagerDuty, email, etc.)
            // Example: await alerting.sendCritical('Redis is down', this.status);
            
            // TODO [5K Users]: Implement circuit breaker that blocks requests after
            // extended Redis outage to prevent cascading failures
        }
    }
}
