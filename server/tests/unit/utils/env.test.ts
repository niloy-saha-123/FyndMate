import { afterEach, describe, expect, it } from 'vitest';
import { assertProductionNonLocalUrl, assertProductionRequired } from '../../../src/lib/env.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('env safety guards', () => {
  it('requires value only in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertProductionRequired('REDIS_URL', '')).toThrow(
      'REDIS_URL environment variable is required in production'
    );
  });

  it('allows missing value outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(() => assertProductionRequired('REDIS_URL', '')).not.toThrow();
  });

  it('rejects local host URLs in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertProductionNonLocalUrl('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db')
    ).toThrow('DATABASE_URL cannot target local host "localhost" in production');
  });

  it('accepts remote URLs in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertProductionNonLocalUrl(
        'SUPABASE_URL',
        'https://example-project-id.supabase.co'
      )
    ).not.toThrow();
  });
});
