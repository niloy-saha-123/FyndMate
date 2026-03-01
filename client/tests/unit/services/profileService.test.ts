/**
 * @file tests/unit/services/profileService.test.ts
 * @description Unit tests for profile service client helpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/apiClient', () => {
  return {
    apiClient: {
      patch: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// Avoid pulling react-native polyfills in test environment
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      order: () => ({ eq: () => ({ limit: () => ({}) }) }),
    }),
  },
}));

import { apiClient } from '../../../src/lib/apiClient';
import { updateProfile } from '../../../src/services/profileService';

describe('profileService.updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps name to fullName, trims nested fields, and omits empty birthDate', async () => {
    const payloadCapture: any[] = [];
    (apiClient.patch as any).mockImplementation((_endpoint: string, body: any) => {
      payloadCapture.push(body);
      return { ...body, id: 'user-1' };
    });

    await updateProfile('supabase-1', {
      name: 'Jane Doe',
      bio: 'Hello there',
      birthDate: '', // should be omitted
      projects: [{ name: ' Project X ', description: '  Build X  ' }],
      experiences: [
        {
          company: '  ACME ',
          position: ' Engineer ',
          description: ' Did things ',
          startDate: '2020-01 ',
          endDate: '2021-02 ',
        },
      ],
    });

    const sent = payloadCapture[0];
    expect(sent.fullName).toBe('Jane Doe');
    expect(sent).not.toHaveProperty('birthDate');
    expect(sent.projects?.[0]).toEqual({
      name: 'Project X',
      description: 'Build X',
    });
    expect(sent.experiences?.[0].company).toBe('ACME');
    expect(sent.experiences?.[0].position).toBe('Engineer');
    expect(sent.experiences?.[0].startDate).toBe('2020-01');
    expect(sent.experiences?.[0].endDate).toBe('2021-02');
  });

  it('rejects when bio exceeds limit and does not call API', async () => {
    const longBio = 'x'.repeat(305);
    (apiClient.patch as any).mockResolvedValue({});

    await expect(
      updateProfile('supabase-1', { bio: longBio })
    ).rejects.toThrow(/Bio cannot exceed 300 characters/);

    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});
