/**
 * @file tests/setup.ts
 * @description Global Vitest test setup for the client (shared mocks/flags).
 */
import { vi } from 'vitest';

(globalThis as any).__DEV__ = false;
