import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────────
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required').max(200),
  password: z.string().min(1, 'Password is required').max(200),
});

export const sendVerificationCodeSchema = z.object({
  email: z.string().trim().email('invalid email').max(200),
});

export const registerSchema = z.object({
  username: z.string().trim().min(2, 'username is required').max(100),
  email: z.string().trim().email('invalid email').max(200),
  verification_code: z.string().trim().regex(/^\d{6}$/, 'verification_code must be 6 digits'),
  password: z.string().min(6, 'password must be at least 6 characters').max(200),
  confirm_password: z.string().min(6).max(200),
});

// ── Album ─────────────────────────────────────────────────────────
export const updateAlbumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  release_date: z.string().nullable().optional(),
  game_id: z.union([z.number().int().positive(), z.null()]).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const bulkUpdateGameSchema = z.object({
  albumIds: z.array(z.number().int().positive()).min(1, 'albumIds is required'),
  gameId: z.union([z.number().int().positive(), z.null()]).optional(),
});

// ── Track ─────────────────────────────────────────────────────────
export const updateTrackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  artists: z.array(z.string().min(1)).optional(),
  album_title: z.string().max(500).optional().nullable(),
  release_date: z.string().nullable().optional(),
  track_number: z.number().int().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const bulkDeleteTracksSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids is required'),
});

export const bulkMoveTracksSchema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1, 'trackIds is required'),
  albumId: z.union([z.number().int().positive(), z.null()]).optional(),
});

// ── Game ──────────────────────────────────────────────────────────
export const createGameSchema = z.object({
  name: z.string().min(1, 'Game name is required').max(200),
  name_en: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  display_order: z.number().int().default(0).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'unreleased']).default('active').optional(),
  cover_path: z.string().max(500).nullable().optional(),
});

export const updateGameSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  name_en: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  display_order: z.number().int().optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'unreleased']).optional(),
  cover_path: z.string().max(500).nullable().optional(),
});

// ── Credits ───────────────────────────────────────────────────────
export const addCreditSchema = z.object({
  credit_key: z.string().min(1, 'credit_key is required').max(200),
  credit_value: z.string().min(1, 'credit_value is required').max(1000),
  display_order: z.number().int().default(0).optional(),
});

export const updateCreditSchema = z.object({
  credit_key: z.string().min(1).max(200),
  credit_value: z.string().min(1).max(1000),
  display_order: z.number().int().optional(),
});

// ── Tags ──────────────────────────────────────────────────────────
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100),
  color: z.string().max(20).default('#1890ff').optional(),
  description: z.string().max(500).nullable().optional(),
  group_id: z.number().int().positive().nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  display_order: z.number().int().default(0).optional(),
});

export const updateTagSchema = createTagSchema;

export const addTagToTrackSchema = z.object({
  tagId: z.number().int().positive('tagId is required'),
});

export const bulkUpdateTrackTagsSchema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1, 'trackIds is required'),
  addTagIds: z.array(z.number().int().positive()).optional(),
  removeTagIds: z.array(z.number().int().positive()).optional(),
});

// ── Tag Groups ────────────────────────────────────────────────────
export const createTagGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  display_order: z.number().int().default(0).optional(),
  parent_group_id: z.number().int().positive().nullable().optional(),
});

export const updateTagGroupSchema = createTagGroupSchema;

// ── Site Settings ───────────────────────────────────────────────
export const firstVisitModalSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1, 'title is required').max(120),
  content: z.string().trim().min(1, 'content is required').max(5000),
  min_stay_seconds: z.number().int().min(5).max(120).optional(),
});

export const siteComplianceSchema = z.object({
  enabled: z.boolean(),
  icp_number: z.string().trim().max(100).optional().default(''),
  public_security_number: z.string().trim().max(100).optional().default(''),
});

export const maintenanceModeSchema = z.object({
  enabled: z.boolean(),
  expected_end_time: z.union([
    z.string().trim().datetime({ message: 'expected_end_time must be ISO datetime' }),
    z.null(),
  ]).optional().default(null),
});

export const feedbackSubmitSchema = z.object({
  content: z.string().trim().min(1, 'content is required').max(2000),
  contact: z.string().trim().max(200).optional().default(''),
});

export const testEmailSchema = z.object({
  email: z.string().trim().email('invalid email').max(200),
});

// ── Artist ────────────────────────────────────────────────────────
export const mergeArtistsSchema = z.object({
  canonicalName: z.string().min(1, 'canonicalName is required').max(500),
  aliasNames: z.array(z.string().min(1).max(500)).min(1, 'aliasNames is required'),
});

export const updateArtistSchema = z.object({
  name: z.string().min(1, 'name is required').max(500),
  roleMappings: z.array(
    z.object({
      from: z.string().min(1).max(200),
      to: z.string().min(1).max(200),
    })
  ).optional(),
});

// ── Debug API ────────────────────────────────────────────────────
const debugScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const debugQuerySchema = z.object({
  sql: z.string().min(1, 'sql is required').max(20000),
  params: z.array(debugScalar).optional(),
  allowWrite: z.boolean().optional(),
});

// ── User Management ─────────────────────────────────────────────
export const updateUserRoleSchema = z.object({
  is_admin: z.boolean(),
});

export const updateUserStatusSchema = z.object({
  account_status: z.enum(['active', 'disabled']),
  status_reason: z.string().trim().max(500).nullable().optional().default(null),
});

export const updateUserEmailVerificationSchema = z.object({
  email_verified: z.boolean(),
});

export const resetUserPasswordSchema = z.object({
  new_password: z.string().min(6, 'new_password must be at least 6 characters').max(200),
});

