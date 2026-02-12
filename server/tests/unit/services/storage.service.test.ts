import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockMove,
  mockList,
  mockCreateSignedUploadUrl,
  mockUpload,
  mockRemove,
  mockDownload,
  mockGetPublicUrl,
  mockFrom,
} = vi.hoisted(() => {
  const move = vi.fn();
  const list = vi.fn();
  const createSignedUploadUrl = vi.fn();
  const upload = vi.fn();
  const remove = vi.fn();
  const download = vi.fn();
  const getPublicUrl = vi.fn();

  const from = vi.fn(() => ({
    move,
    list,
    createSignedUploadUrl,
    upload,
    remove,
    download,
    getPublicUrl,
  }));

  return {
    mockMove: move,
    mockList: list,
    mockCreateSignedUploadUrl: createSignedUploadUrl,
    mockUpload: upload,
    mockRemove: remove,
    mockDownload: download,
    mockGetPublicUrl: getPublicUrl,
    mockFrom: from,
  };
});

vi.mock('../../../src/lib/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    storage: {
      from: mockFrom,
    },
  },
}));

vi.mock('../../../src/utils/circuit-breaker.js', () => ({
  withCircuitBreaker: vi.fn(async (_name: string, operation: () => Promise<any>) => operation()),
}));

import {
  moveStoragePathToQuarantine,
  moveUserFilesToQuarantine,
  toStoragePath,
} from '../../../src/services/storage.service.js';

describe('storage.service quarantine helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toStoragePath extracts relative object path from public URL', () => {
    const path = toStoragePath(
      'https://example.supabase.co/storage/v1/object/public/profile-pictures/user-1/avatar.jpg'
    );

    expect(path).toBe('user-1/avatar.jpg');
  });

  it('moveStoragePathToQuarantine moves object and returns destination', async () => {
    mockMove.mockResolvedValue({ error: null });

    const result = await moveStoragePathToQuarantine('user-1/avatar.jpg', 'delete-ref-1');

    expect(mockFrom).toHaveBeenCalledWith('profile-pictures');
    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(result.failed).toHaveLength(0);
    expect(result.moved).toHaveLength(1);
    expect(result.moved[0].sourcePath).toBe('user-1/avatar.jpg');
    expect(result.moved[0].quarantinePath).toContain('deleted-accounts/delete-ref-1/');
  });

  it('moveStoragePathToQuarantine returns failure when move fails', async () => {
    mockMove.mockResolvedValue({ error: { message: 'Permission denied' } });

    const result = await moveStoragePathToQuarantine('user-2/avatar.jpg', 'delete-ref-2');

    expect(result.moved).toHaveLength(0);
    expect(result.failed).toEqual([
      {
        sourcePath: 'user-2/avatar.jpg',
        reason: 'Permission denied',
      },
    ]);
  });

  it('moveUserFilesToQuarantine handles empty folder', async () => {
    mockList.mockResolvedValue({ data: [], error: null });

    const result = await moveUserFilesToQuarantine('user-3', 'delete-ref-3');

    expect(result).toEqual({ moved: [], failed: [] });
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('moveUserFilesToQuarantine moves files and captures per-file failures', async () => {
    mockList.mockResolvedValue({
      data: [{ name: 'one.jpg' }, { name: 'two.jpg' }],
      error: null,
    });

    mockMove
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'second move failed' } });

    const result = await moveUserFilesToQuarantine('user-4', 'delete-ref-4');

    expect(mockMove).toHaveBeenCalledTimes(2);
    expect(result.moved).toHaveLength(1);
    expect(result.moved[0].sourcePath).toBe('user-4/one.jpg');
    expect(result.failed).toEqual([
      {
        sourcePath: 'user-4/two.jpg',
        reason: 'second move failed',
      },
    ]);
  });
});
