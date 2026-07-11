import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  createGameSchema,
  updateGameSchema,
  sendSiteMessageSchema,
  clearAllTrackNotesSchema,
  bulkDeleteTracksSchema,
  exportMusicSourcesSchema,
  maintenanceModeSchema,
} from '../src/validators/schemas';

describe('zod schemas — happy paths', () => {
  it('loginSchema accepts identifier + password', () => {
    const result = loginSchema.safeParse({ identifier: '  alice ', password: 'pw' });
    expect(result.success).toBe(true);
    if (result.success) {
      // trim transformation applies
      expect(result.data.identifier).toBe('alice');
    }
  });

  it('registerSchema accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      username: 'bob',
      email: 'bob@example.com',
      verification_challenge_id: 'b6e8f2a4-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
      verification_code: '123456',
      password: 'secret1',
      confirm_password: 'secret1',
    });
    expect(result.success).toBe(true);
  });

  it('registerSchema rejects a non-uuid verification_challenge_id', () => {
    const result = registerSchema.safeParse({
      username: 'bob',
      email: 'bob@example.com',
      verification_challenge_id: 'not-a-uuid',
      verification_code: '123456',
      password: 'secret1',
      confirm_password: 'secret1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('verification_challenge_id'))).toBe(true);
    }
  });

  it('registerSchema rejects a 5-digit verification_code', () => {
    const result = registerSchema.safeParse({
      username: 'bob',
      email: 'bob@example.com',
      verification_challenge_id: 'b6e8f2a4-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
      verification_code: '12345',
      password: 'secret1',
      confirm_password: 'secret1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('verification_code'))).toBe(true);
    }
  });

  it('createGameSchema applies the default status of active', () => {
    const result = createGameSchema.safeParse({ name: 'Genshin' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
      expect(result.data.display_order).toBe(0);
    }
  });

  it('updateGameSchema allows partial updates (all fields optional)', () => {
    const result = updateGameSchema.safeParse({ name: 'Honkai' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Honkai');
    }
  });

  it('updateGameSchema rejects an invalid status enum', () => {
    const result = updateGameSchema.safeParse({ status: 'banned' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('status'))).toBe(true);
    }
  });

  it('sendSiteMessageSchema accepts a broadcast with defaults', () => {
    const result = sendSiteMessageSchema.safeParse({
      title: 'Notice',
      content: 'Maintenance tonight',
      is_broadcast: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_broadcast).toBe(true);
      expect(result.data.recipient_user_ids).toEqual([]);
      expect(result.data.expires_at).toBeNull();
    }
  });

  it('sendSiteMessageSchema rejects an empty title', () => {
    const result = sendSiteMessageSchema.safeParse({ title: '   ', content: 'x' });
    expect(result.success).toBe(false);
  });

  it('clearAllTrackNotesSchema requires the exact literal', () => {
    expect(clearAllTrackNotesSchema.safeParse({ confirm: 'CLEAR_ALL_NOTES' }).success).toBe(true);
    expect(clearAllTrackNotesSchema.safeParse({ confirm: 'yes' }).success).toBe(false);
  });

  it('bulkDeleteTracksSchema rejects an empty ids array', () => {
    expect(bulkDeleteTracksSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkDeleteTracksSchema.safeParse({ ids: [1, 2] }).success).toBe(true);
  });

  it('exportMusicSourcesSchema applies default scope of all', () => {
    const result = exportMusicSourcesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe('all');
      expect(result.data.game_ids).toEqual([]);
    }
  });

  it('maintenanceModeSchema accepts an ISO datetime', () => {
    const result = maintenanceModeSchema.safeParse({
      enabled: true,
      expected_end_time: '2026-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('maintenanceModeSchema rejects a non-ISO datetime', () => {
    const result = maintenanceModeSchema.safeParse({
      enabled: true,
      expected_end_time: 'tomorrow',
    });
    expect(result.success).toBe(false);
  });
});
