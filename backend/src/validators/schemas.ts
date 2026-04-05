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
  verification_challenge_id: z.string().trim().uuid('verification_challenge_id must be uuid'),
  verification_code: z.string().trim().regex(/^\d{6}$/, 'verification_code must be 6 digits'),
  password: z.string().min(6, 'password must be at least 6 characters').max(200),
  confirm_password: z.string().min(6).max(200),
});

// ── Album ─────────────────────────────────────────────────────────
export const updateAlbumSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  title_cn: z.string().max(500).nullable().optional(),
  title_en: z.string().max(500).nullable().optional(),
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
  title_cn: z.string().max(500).nullable().optional(),
  title_en: z.string().max(500).nullable().optional(),
  artists: z.array(z.string().min(1)).optional(),
  album_title: z.string().max(500).optional().nullable(),
  release_date: z.string().nullable().optional(),
  track_number: z.number().int().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const albumMetadataReplaceItemSchema = z.object({
  uuid: z.string().trim().uuid('album uuid must be uuid'),
  title: z.string().trim().max(500).optional(),
  title_cn: z.string().trim().max(500).nullable().optional(),
  title_en: z.string().trim().max(500).nullable().optional(),
});

const trackMetadataReplaceItemSchema = z.object({
  uuid: z.string().trim().uuid('track uuid must be uuid'),
  title: z.string().trim().max(500).optional(),
  title_cn: z.string().trim().max(500).nullable().optional(),
  title_en: z.string().trim().max(500).nullable().optional(),
});

export const importCatalogMetadataByUuidSchema = z.object({
  albums: z.array(albumMetadataReplaceItemSchema).optional().default([]),
  tracks: z.array(trackMetadataReplaceItemSchema).optional().default([]),
  sync_legacy_title: z.boolean().optional().default(false),
}).refine((value) => value.albums.length > 0 || value.tracks.length > 0, {
  message: 'albums or tracks is required',
  path: ['albums'],
});

export const previewCatalogMetadataByUuidSchema = importCatalogMetadataByUuidSchema;
export const commitCatalogMetadataByUuidSchema = importCatalogMetadataByUuidSchema;

export const rollbackCatalogMetadataBatchSchema = z.object({
  batch_uuid: z.string().trim().uuid('batch_uuid must be uuid'),
});

export const bulkDeleteTracksSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids is required'),
});

export const bulkMoveTracksSchema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1, 'trackIds is required'),
  albumId: z.union([z.number().int().positive(), z.null()]).optional(),
});

const trackNotesImportEntrySchema = z.object({
  row_key: z.string().trim().min(1, 'row_key is required').max(120),
  song_name: z.string().trim().min(1, 'song_name is required').max(500),
  // Allow long/dirty values here; per-item matcher will normalize and mark invalid when needed.
  song_number: z.union([z.string().trim().max(5000), z.number(), z.null()]).optional(),
  // Keep batch import tolerant: missing/empty lines become per-item invalid instead of request-level failure.
  note_lines: z.array(z.string().trim().max(1000)).max(300).optional().default([]),
});

export const previewTrackNotesImportSchema = z.object({
  entries: z.array(trackNotesImportEntrySchema).min(1, 'entries is required').max(5000),
});

export const commitTrackNotesImportSchema = z.object({
  entries: z.array(trackNotesImportEntrySchema).min(1, 'entries is required').max(5000),
  resolutions: z.record(z.string(), z.number().int().positive()).optional().default({}),
  conflict_mode: z.enum(['overwrite', 'append', 'skip']).optional().default('overwrite'),
});

const musicSourcePathSchema = z.array(z.string().trim().min(1).max(200)).min(1).max(20);

const musicSourceImportSourceSchema = z.object({
  category: z.string().trim().min(1, 'category is required').max(200),
  path: musicSourcePathSchema,
  category_uuid: z.string().trim().uuid('category_uuid must be uuid').optional(),
  node_uuid: z.string().trim().uuid('node_uuid must be uuid').optional(),
  path_node_uuids: z.array(z.string().trim().uuid('path_node_uuids items must be uuid')).optional(),
}).refine((value) => {
  if (!value.path_node_uuids) return true;
  return value.path_node_uuids.length === value.path.length;
}, {
  message: 'path_node_uuids length must match path length',
  path: ['path_node_uuids'],
});

const musicSourceImportEntrySchema = z.object({
  row_key: z.string().trim().min(1, 'row_key is required').max(120),
  song_name: z.string().trim().min(1, 'song_name is required').max(500),
  song_number: z.union([z.string().trim().max(5000), z.number(), z.null()]).optional(),
  album_name: z.string().trim().max(500).optional().nullable(),
  game_id: z.number().int().positive('game_id is required'),
  // Import accepts empty sources and downgrades it to per-item warning/skip semantics.
  sources: z.array(musicSourceImportSourceSchema).max(200).optional().default([]),
});

export const createMusicSourceCategorySchema = z.object({
  game_id: z.number().int().positive('game_id is required'),
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  display_order: z.number().int().optional().default(0),
});

export const updateMusicSourceCategorySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  display_order: z.number().int().optional().default(0),
});

export const createMusicSourceNodeSchema = z.object({
  game_id: z.number().int().positive('game_id is required'),
  category_id: z.number().int().positive('category_id is required'),
  parent_id: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, 'name is required').max(200),
  display_order: z.number().int().optional().default(0),
});

export const updateMusicSourceNodeSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  display_order: z.number().int().optional().default(0),
});

export const upsertTrackMusicSourcesSchema = z.object({
  conflict_mode: z.enum(['overwrite', 'append', 'skip']).optional().default('overwrite'),
  sources: z.array(z.object({
    game_id: z.number().int().positive(),
    category_id: z.number().int().positive(),
    node_id: z.number().int().positive(),
    display_order: z.number().int().optional(),
  })).min(1, 'sources is required').max(500),
});

export const musicSourceImportPreviewSchema = z.object({
  entries: z.array(musicSourceImportEntrySchema).min(1, 'entries is required').max(5000),
});

export const musicSourceImportCommitSchema = z.object({
  entries: z.array(musicSourceImportEntrySchema).min(1, 'entries is required').max(5000),
  resolutions: z.record(z.string(), z.number().int().positive()).optional().default({}),
  conflict_mode: z.enum(['overwrite', 'append', 'skip', 'replace']).optional().default('overwrite'),
});

export const exportMusicSourcesSchema = z.object({
  scope: z.enum(['all', 'by_game', 'by_album', 'by_category']).optional().default('all'),
  game_ids: z.array(z.number().int().positive()).optional().default([]),
  album_ids: z.array(z.number().int().positive()).optional().default([]),
  category_ids: z.array(z.number().int().positive()).optional().default([]),
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
  message: z.string().trim().max(5000).optional().default(''),
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

// ── Site Messages ─────────────────────────────────────────────
export const sendSiteMessageSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  content: z.string().trim().min(1, 'content is required').max(10000),
  is_broadcast: z.boolean().optional().default(false),
  recipient_user_ids: z.array(z.number().int().positive()).optional().default([]),
  expires_at: z.union([
    z.string().trim().datetime({ message: 'expires_at must be ISO datetime' }),
    z.null(),
  ]).optional().default(null),
});

