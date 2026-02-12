import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiGet = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../../src/lib/apiClient', () => ({
  apiClient: {
    get: mockApiGet,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
}));

vi.mock('../../../src/auth/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import {
  deleteMyAccount,
  getOrCreateProfile,
  getUserProfileById,
  updateProfile,
} from '../../../src/services/profileService';

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateProfile maps name to fullName and trims project/experience fields', async () => {
    mockApiPatch.mockResolvedValue({
      id: 'u1',
      name: 'Niloy',
      bio: 'Bio',
      skills: ['React'],
      interests: ['Startups'],
      projects: [{ id: 'p1', title: 'Clean Name', description: 'Clean Description' }],
      experiences: [
        {
          id: 'e1',
          company: 'Acme',
          position: 'Intern',
          description: 'Did work',
          startDate: '2024-01',
          endDate: '2024-05',
        },
      ],
      age: 23,
      birthDate: '2002-01-01',
      city: 'Dhaka',
      country: 'Bangladesh',
      githubUsername: 'niloy',
    });

    await updateProfile('sb-1', {
      name: 'Niloy',
      projects: [
        { name: '  Clean Name  ', description: '  Clean Description  ' },
      ],
      experiences: [
        {
          company: '  Acme  ',
          position: '  Intern  ',
          description: '  Did work  ',
          startDate: '2024-01',
          endDate: '2024-05',
        },
      ],
    } as any);

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [, payload] = mockApiPatch.mock.calls[0];

    expect(payload.fullName).toBe('Niloy');
    expect(payload.projects[0]).toEqual({
      name: 'Clean Name',
      description: 'Clean Description',
    });
    expect(payload.experiences[0]).toEqual({
      company: 'Acme',
      position: 'Intern',
      description: 'Did work',
      startDate: '2024-01',
      endDate: '2024-05',
    });
  });

  it('updateProfile throws before API call for invalid GitHub username', async () => {
    await expect(
      updateProfile('sb-1', {
        githubUsername: '-invalid-',
      } as any)
    ).rejects.toThrow('GitHub username is invalid');

    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('updateProfile throws when end date exists without start date', async () => {
    await expect(
      updateProfile('sb-1', {
        experiences: [
          {
            company: 'Acme',
            position: 'Intern',
            endDate: '2024-06',
          },
        ],
      } as any)
    ).rejects.toThrow('Experience end date requires a start date');

    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('getUserProfileById normalizes response shape', async () => {
    mockApiGet.mockResolvedValue({
      id: 'u2',
      fullName: 'Rahbir',
      bio: 'Hi',
      skills: ['TS'],
      interests: ['Open Source'],
      projects: [{ id: 'p2', title: 'FyndMate', description: 'A platform' }],
      experiences: [{ id: 'e2', company: 'Meta', position: 'Intern', startDate: '2024-01' }],
      city: 'Dhaka',
      country: 'Bangladesh',
    });

    const profile = await getUserProfileById('u2');

    expect(mockApiGet).toHaveBeenCalledWith('/api/profile/u2');
    expect(profile.name).toBe('Rahbir');
    expect(profile.projects[0]).toEqual({ id: 'p2', name: 'FyndMate', description: 'A platform' });
    expect(profile.interests).toEqual(['Open Source']);
    expect(profile.lookingFor).toEqual(['Open Source']);
    expect(profile.location).toBe('Dhaka, Bangladesh');
  });

  it('deleteMyAccount calls DELETE endpoint', async () => {
    mockApiDelete.mockResolvedValue({ success: true });

    const result = await deleteMyAccount();

    expect(mockApiDelete).toHaveBeenCalledWith('/api/profile/me');
    expect(result).toEqual({ success: true });
  });

  it('getOrCreateProfile returns defaults when user row does not exist', async () => {
    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom.mockReturnValue(userQuery);

    const profile = await getOrCreateProfile('sb-999', { name: 'Fallback User' });

    expect(profile.id).toBe('sb-999');
    expect(profile.name).toBe('Fallback User');
    expect(profile.skills).toEqual([]);
    expect(profile.interests).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(profile.experiences).toEqual([]);
  });

  it('getOrCreateProfile includes projects and experiences for existing user', async () => {
    const userQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          name: 'User One',
          interests: ['Startups'],
          skills: ['TS'],
          city: 'Dhaka',
          country: 'Bangladesh',
        },
        error: null,
      }),
    };

    const projectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', title: 'Proj', description: 'Desc' }],
      }),
    };

    const experienceQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'e1', company: 'Acme', position: 'Intern', startDate: '2024-01' }],
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'User') return userQuery;
      if (table === 'Project') return projectQuery;
      if (table === 'Experience') return experienceQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const profile = await getOrCreateProfile('sb-user-1');

    expect(profile.id).toBe('user-1');
    expect(profile.projects[0].name).toBe('Proj');
    expect(profile.experiences[0].company).toBe('Acme');
  });
});
