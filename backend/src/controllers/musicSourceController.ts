import { Request, Response } from 'express';
import pool from '../config/database';
import type { PoolClient } from 'pg';

type ConflictMode = 'overwrite' | 'append' | 'skip';
type ImportStatus = 'matched' | 'needs_manual' | 'not_found' | 'invalid' | 'imported' | 'skipped' | 'error';

interface MusicSourceNodeRecord {
  id: number;
  uuid?: string;
  game_id: number;
  category_id: number;
  parent_id: number | null;
  name: string;
}

interface MusicSourceImportSource {
  category: string;
  path: string[];
  category_uuid?: string;
  node_uuid?: string;
  path_node_uuids?: string[];
}

interface NormalizedMusicSourceImportSource {
  category: string;
  path: string[];
  category_uuid?: string;
  node_uuid?: string;
  path_node_uuids?: Array<string | null>;
}

interface MusicSourceImportEntry {
  row_key: string;
  song_name: string;
  song_number?: string | number | null;
  album_name?: string | null;
  game_id: number;
  sources: MusicSourceImportSource[];
}

interface MusicSourceImportItem {
  row_key: string;
  song_name: string;
  song_number_raw: string;
  status: ImportStatus;
  message?: string;
  matched_track_id?: number;
  source_count: number;
  candidates?: Array<{
    track_id: number;
    title: string;
    track_number: number | null;
    album_title: string;
    artists: string;
  }>;
}

interface ResolvedImportEntry {
  status: 'matched' | 'needs_manual' | 'not_found' | 'invalid';
  matched_track_id?: number;
  message?: string;
  candidates?: Array<{
    track_id: number;
    title: string;
    track_number: number | null;
    album_title: string;
    artists: string;
  }>;
  has_empty_sources: boolean;
  normalized_sources: NormalizedMusicSourceImportSource[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeTrackNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const digits = raw.trim().match(/\d+/)?.[0];
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeConflictMode = (value: unknown): ConflictMode => {
  if (value === 'append' || value === 'skip') return value;
  return 'overwrite';
};

const mapCandidate = (row: any) => ({
  track_id: Number(row.track_id),
  title: String(row.title || ''),
  track_number: row.track_number == null ? null : Number(row.track_number),
  album_title: String(row.album_title || ''),
  artists: String(row.artists || ''),
});

const queryTrackById = async (trackId: number) => {
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title_en AS title,
       t.track_number,
       COALESCE(a.title_en, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists
     FROM tracks t
     LEFT JOIN albums a ON a.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE t.id = $1
     GROUP BY t.id, t.title_en, t.track_number, a.title_en
     LIMIT 1`,
    [trackId]
  );
  return result.rows.length > 0 ? mapCandidate(result.rows[0]) : null;
};

const queryTrackCandidates = async (songName: string, trackNumber: number) => {
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title_en AS title,
       t.track_number,
       COALESCE(a.title_en, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists
     FROM tracks t
     LEFT JOIN albums a ON a.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
      WHERE LOWER(TRIM(COALESCE(t.title_en, ''))) = LOWER(TRIM($1))
       AND t.track_number = $2
      GROUP BY t.id, t.title_en, t.track_number, a.title_en
     ORDER BY t.id ASC`,
    [songName, trackNumber]
  );
  return result.rows.map(mapCandidate);
};

const searchTrackCandidatesForMusicSourceImport = async (keyword: string, limit: number) => {
  const normalizedKeyword = keyword.trim();
  const numericKeyword = Number.parseInt(normalizedKeyword, 10);
  const hasNumericKeyword = Number.isInteger(numericKeyword) && numericKeyword > 0;

  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title_en AS title,
       t.track_number,
       COALESCE(a.title_en, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists,
       CASE
         WHEN LOWER(TRIM(COALESCE(t.title_en, ''))) = LOWER(TRIM($1)) THEN 0
         WHEN $3::boolean AND t.id = $4 THEN 1
         WHEN $3::boolean AND t.track_number = $4 THEN 2
         ELSE 3
       END AS match_rank
     FROM tracks t
     LEFT JOIN albums a ON a.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE LOWER(COALESCE(t.title_en, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(a.title_en, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(ar.name, '')) LIKE LOWER($2)
        OR ($3::boolean AND t.id = $4)
        OR ($3::boolean AND t.track_number = $4)
     GROUP BY t.id, t.title_en, t.track_number, a.title_en
     ORDER BY match_rank ASC, t.id ASC
     LIMIT $5`,
    [normalizedKeyword, `%${normalizedKeyword}%`, hasNumericKeyword, hasNumericKeyword ? numericKeyword : null, limit]
  );

  return result.rows.map(mapCandidate);
};

const validateImportSource = (source: MusicSourceImportSource): { normalized?: NormalizedMusicSourceImportSource; message?: string } => {
  const categoryName = String(source.category || '').trim();
  const pathSegments = Array.isArray(source.path)
    ? source.path.map((segment) => String(segment || '').trim()).filter(Boolean)
    : [];
  const categoryUuid = typeof source.category_uuid === 'string' ? source.category_uuid.trim() : '';
  const nodeUuid = typeof source.node_uuid === 'string' ? source.node_uuid.trim() : '';
  const rawPathNodeUuids = Array.isArray(source.path_node_uuids) ? source.path_node_uuids : [];
  const pathNodeUuids = rawPathNodeUuids.map((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
  });

  if (!categoryName) {
    return { message: 'source.category is required' };
  }
  if (pathSegments.length === 0) {
    return { message: 'source.path cannot be empty' };
  }
  if (categoryUuid && !UUID_RE.test(categoryUuid)) {
    return { message: 'source.category_uuid must be uuid' };
  }
  if (nodeUuid && !UUID_RE.test(nodeUuid)) {
    return { message: 'source.node_uuid must be uuid' };
  }
  if (pathNodeUuids.length > 0 && pathNodeUuids.length !== pathSegments.length) {
    return { message: 'source.path_node_uuids length must match source.path length' };
  }
  if (pathNodeUuids.some((uuid) => uuid != null && !UUID_RE.test(uuid))) {
    return { message: 'source.path_node_uuids contains non-uuid value' };
  }
  if (nodeUuid && pathNodeUuids.length > 0) {
    const leafUuid = pathNodeUuids[pathNodeUuids.length - 1];
    if (leafUuid && leafUuid !== nodeUuid) {
      return { message: 'source.node_uuid must match last item of source.path_node_uuids when both provided' };
    }
  }

  return {
    normalized: {
      category: categoryName,
      path: pathSegments,
      category_uuid: categoryUuid || undefined,
      node_uuid: nodeUuid || undefined,
      path_node_uuids: pathNodeUuids.length > 0 ? pathNodeUuids : undefined,
    },
  };
};

const findCategory = async (
  client: PoolClient,
  gameId: number,
  categoryName: string,
  categoryUuid?: string
): Promise<{ id: number; uuid: string } | null> => {
  if (categoryUuid) {
    const byUuid = await client.query(
      `SELECT id, uuid::text AS uuid, name
       FROM music_source_categories
       WHERE game_id = $1 AND uuid = $2
       LIMIT 1`,
      [gameId, categoryUuid]
    );
    if (byUuid.rows.length > 0) {
      const row = byUuid.rows[0];
      if (String(row.name || '').trim().toLowerCase() !== categoryName.toLowerCase()) {
        await client.query(
          'UPDATE music_source_categories SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [categoryName, Number(row.id)]
        );
      }
      return { id: Number(row.id), uuid: String(row.uuid) };
    }
  }

  const categoryResult = await client.query(
    'SELECT id, uuid::text AS uuid FROM music_source_categories WHERE game_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1',
    [gameId, categoryName]
  );
  if (categoryResult.rows.length === 0) return null;
  return {
    id: Number(categoryResult.rows[0].id),
    uuid: String(categoryResult.rows[0].uuid),
  };
};

const createCategory = async (
  client: PoolClient,
  gameId: number,
  categoryName: string,
  categoryUuid?: string
): Promise<{ id: number; uuid: string }> => {
  const insertResult = await client.query(
    `INSERT INTO music_source_categories (game_id, uuid, name, display_order)
     VALUES ($1, COALESCE($2::uuid, gen_random_uuid()), $3, COALESCE((SELECT MAX(display_order) + 1 FROM music_source_categories WHERE game_id = $1), 0))
     RETURNING id, uuid::text AS uuid`,
    [gameId, categoryUuid || null, categoryName]
  );
  return {
    id: Number(insertResult.rows[0].id),
    uuid: String(insertResult.rows[0].uuid),
  };
};

const findNode = async (
  client: PoolClient,
  gameId: number,
  categoryId: number,
  parentId: number | null,
  name: string,
  nodeUuid?: string
): Promise<{ id: number; uuid: string } | null> => {
  if (nodeUuid) {
    const byUuid: { rows: Array<{ id: number; uuid: string; parent_id: number | null; name: string }> } = await client.query(
      `SELECT id, uuid::text AS uuid, parent_id, name
       FROM music_source_nodes
       WHERE game_id = $1
         AND category_id = $2
         AND uuid = $3
       LIMIT 1`,
      [gameId, categoryId, nodeUuid]
    );
    if (byUuid.rows.length > 0) {
      const row = byUuid.rows[0];
      if ((row.parent_id == null ? null : Number(row.parent_id)) !== parentId || String(row.name || '').trim() !== name) {
        await client.query(
          `UPDATE music_source_nodes
           SET parent_id = $1, name = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [parentId, name, Number(row.id)]
        );
      }
      return { id: Number(row.id), uuid: String(row.uuid) };
    }
  }

  const nodeResult: { rows: Array<{ id: number; uuid: string }> } = await client.query(
    `SELECT id, uuid::text AS uuid
     FROM music_source_nodes
     WHERE game_id = $1
       AND category_id = $2
       AND ((parent_id IS NULL AND $3::int IS NULL) OR parent_id = $3)
       AND LOWER(TRIM(name)) = LOWER(TRIM($4))
     LIMIT 1`,
    [gameId, categoryId, parentId, name]
  );
  if (nodeResult.rows.length === 0) return null;
  return {
    id: Number(nodeResult.rows[0].id),
    uuid: String(nodeResult.rows[0].uuid),
  };
};

const createNode = async (
  client: PoolClient,
  gameId: number,
  categoryId: number,
  parentId: number | null,
  name: string,
  nodeUuid?: string
): Promise<{ id: number; uuid: string }> => {
  const insertResult = await client.query(
    `INSERT INTO music_source_nodes (game_id, category_id, parent_id, uuid, name, display_order)
     VALUES (
       $1,
       $2,
       $3,
       COALESCE($4::uuid, gen_random_uuid()),
       $5,
       COALESCE((SELECT MAX(display_order) + 1 FROM music_source_nodes WHERE game_id = $1 AND category_id = $2 AND ((parent_id IS NULL AND $3::int IS NULL) OR parent_id = $3)), 0)
     )
     RETURNING id, uuid::text AS uuid`,
    [gameId, categoryId, parentId, nodeUuid || null, name]
  );
  return {
    id: Number(insertResult.rows[0].id),
    uuid: String(insertResult.rows[0].uuid),
  };
};

const ensureSourcePathNode = async (client: PoolClient, gameId: number, source: NormalizedMusicSourceImportSource): Promise<number> => {
  const categoryName = source.category;
  const pathSegments = source.path;
  const pathNodeUuids = source.path_node_uuids || [];
  const leafNodeUuid = source.node_uuid;

  let category = await findCategory(client, gameId, categoryName, source.category_uuid);
  if (!category) {
    try {
      category = await createCategory(client, gameId, categoryName, source.category_uuid);
    } catch (error: any) {
      if (error?.code === '23505') {
        category = await findCategory(client, gameId, categoryName, source.category_uuid);
      }
      if (!category) throw error;
    }
  }

  let parentId: number | null = null;
  let currentNodeId: number | null = null;

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    const preferredUuid = pathNodeUuids[i]
      || (i === pathSegments.length - 1 ? leafNodeUuid : undefined);

    let nextNode = await findNode(client, gameId, category.id, parentId, segment, preferredUuid);
    if (!nextNode) {
      try {
        nextNode = await createNode(client, gameId, category.id, parentId, segment, preferredUuid);
      } catch (error: any) {
        if (error?.code === '23505') {
          nextNode = await findNode(client, gameId, category.id, parentId, segment, preferredUuid);
        }
        if (!nextNode) throw error;
      }
    }

    currentNodeId = nextNode.id;
    parentId = currentNodeId;
  }

  if (!currentNodeId) {
    throw new Error('Unable to resolve source node');
  }

  return currentNodeId;
};

const resolveImportEntry = async (
  entry: MusicSourceImportEntry,
  resolutions: Record<string, number>
): Promise<ResolvedImportEntry> => {
  const songName = String(entry.song_name || '').trim();
  const trackNumber = normalizeTrackNumber(entry.song_number);
  const gameId = Number(entry.game_id);
  const albumName = String(entry.album_name || '').trim();
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  const hasEmptySources = sources.length === 0;

  if (!songName) return { status: 'invalid', message: 'song_name is required', has_empty_sources: hasEmptySources, normalized_sources: [] };
  if (!trackNumber) return { status: 'invalid', message: 'song_number is required for matching', has_empty_sources: hasEmptySources, normalized_sources: [] };
  if (!Number.isInteger(gameId) || gameId <= 0) return { status: 'invalid', message: 'game_id must be positive integer', has_empty_sources: hasEmptySources, normalized_sources: [] };

  const normalizedSources: NormalizedMusicSourceImportSource[] = [];
  if (!hasEmptySources) {
    for (const source of sources) {
      const validatedSource = validateImportSource(source);
      if (!validatedSource.normalized) {
        return { status: 'invalid', message: validatedSource.message || 'Invalid source path', has_empty_sources: hasEmptySources, normalized_sources: [] };
      }
      normalizedSources.push(validatedSource.normalized);
    }
  }

  const selectedTrackId = Number(resolutions[entry.row_key]);
  if (Number.isInteger(selectedTrackId) && selectedTrackId > 0) {
    const selectedCandidate = await queryTrackById(selectedTrackId);
    if (selectedCandidate) {
      return {
        status: 'matched',
        matched_track_id: selectedCandidate.track_id,
        candidates: [selectedCandidate],
        has_empty_sources: hasEmptySources,
        normalized_sources: normalizedSources,
      };
    }
  }

  const candidates = await queryTrackCandidates(songName, trackNumber);
  if (candidates.length === 0) {
    return { status: 'not_found', message: 'No track found by song_name + song_number', has_empty_sources: hasEmptySources, normalized_sources: normalizedSources };
  }
  if (candidates.length === 1) {
    return { status: 'matched', matched_track_id: candidates[0].track_id, candidates, has_empty_sources: hasEmptySources, normalized_sources: normalizedSources };
  }

  if (albumName) {
    const albumMatched = candidates.filter((candidate) => candidate.album_title.trim().toLowerCase() === albumName.toLowerCase());
    if (albumMatched.length === 1) {
      return { status: 'matched', matched_track_id: albumMatched[0].track_id, candidates: albumMatched, has_empty_sources: hasEmptySources, normalized_sources: normalizedSources };
    }
  }

  const selectedCandidate = candidates.find((candidate) => candidate.track_id === selectedTrackId);
  if (selectedCandidate) {
    return { status: 'matched', matched_track_id: selectedCandidate.track_id, candidates, has_empty_sources: hasEmptySources, normalized_sources: normalizedSources };
  }

  return {
    status: 'needs_manual',
    message: 'Multiple tracks matched song_name + song_number. Please resolve manually.',
    candidates,
    has_empty_sources: hasEmptySources,
    normalized_sources: normalizedSources,
  };
};

const appendImportWarnings = (message: string | undefined, hasEmptySources: boolean): string | undefined => {
  const parts: string[] = [];
  if (message) parts.push(message);
  if (hasEmptySources) {
    parts.push('sources is empty; row will be skipped during commit');
  }
  parts.push('missing category/path in DB will be auto-created during commit');
  return parts.join('; ');
};

const listAllNodes = async (): Promise<Map<number, MusicSourceNodeRecord>> => {
  const result = await pool.query<MusicSourceNodeRecord>(
    'SELECT id, uuid::text AS uuid, game_id, category_id, parent_id, name FROM music_source_nodes'
  );
  const lookup = new Map<number, MusicSourceNodeRecord>();
  for (const row of result.rows) {
    lookup.set(Number(row.id), {
      id: Number(row.id),
      uuid: row.uuid ? String(row.uuid) : undefined,
      game_id: Number(row.game_id),
      category_id: Number(row.category_id),
      parent_id: row.parent_id == null ? null : Number(row.parent_id),
      name: String(row.name),
    });
  }
  return lookup;
};

const buildPathSegments = (nodeId: number, nodeLookup: Map<number, MusicSourceNodeRecord>): string[] => {
  const segments: string[] = [];
  let currentId: number | null = nodeId;
  const guard = new Set<number>();

  while (currentId != null) {
    if (guard.has(currentId)) break;
    guard.add(currentId);

    const node = nodeLookup.get(currentId);
    if (!node) break;
    segments.unshift(node.name);
    currentId = node.parent_id;
  }

  return segments;
};

const buildPathNodeUuids = (nodeId: number, nodeLookup: Map<number, MusicSourceNodeRecord>): string[] => {
  const uuids: string[] = [];
  let currentId: number | null = nodeId;
  const guard = new Set<number>();

  while (currentId != null) {
    if (guard.has(currentId)) break;
    guard.add(currentId);

    const node = nodeLookup.get(currentId);
    if (!node) break;
    if (node.uuid) {
      uuids.unshift(node.uuid);
    }
    currentId = node.parent_id;
  }

  return uuids;
};

export const getMusicSourceCategories = async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.query.game_id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_GAME_ID', message: 'game_id must be a positive integer' },
      });
    }

    const result = await pool.query(
      `SELECT id, uuid::text AS uuid, game_id, name, description, display_order, created_at, updated_at
       FROM music_source_categories
       WHERE game_id = $1
       ORDER BY display_order ASC, name ASC`,
      [gameId]
    );

    return res.json({ success: true, data: { categories: result.rows } });
  } catch (error) {
    console.error('Get music source categories error:', error);
    return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch categories' } });
  }
};

export const createMusicSourceCategory = async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.body.game_id);
    const name = String(req.body.name || '').trim();
    const description = req.body.description == null ? null : String(req.body.description).trim();
    const displayOrder = Number.isInteger(req.body.display_order) ? Number(req.body.display_order) : 0;

    if (!Number.isInteger(gameId) || gameId <= 0 || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'game_id and name are required' },
      });
    }

    const result = await pool.query(
      `INSERT INTO music_source_categories (game_id, name, description, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, uuid::text AS uuid, game_id, name, description, display_order, created_at, updated_at`,
      [gameId, name, description, displayOrder]
    );

    return res.status(201).json({ success: true, data: { category: result.rows[0] } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Category already exists in this game' } });
    }
    console.error('Create music source category error:', error);
    return res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create category' } });
  }
};

export const updateMusicSourceCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || '').trim();
    const description = req.body.description == null ? null : String(req.body.description).trim();
    const displayOrder = Number.isInteger(req.body.display_order) ? Number(req.body.display_order) : 0;

    if (!Number.isInteger(id) || id <= 0 || !name) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'id and name are required' } });
    }

    const result = await pool.query(
      `UPDATE music_source_categories
       SET name = $1, description = $2, display_order = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, uuid::text AS uuid, game_id, name, description, display_order, created_at, updated_at`,
      [name, description, displayOrder, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    return res.json({ success: true, data: { category: result.rows[0] } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Category already exists in this game' } });
    }
    console.error('Update music source category error:', error);
    return res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update category' } });
  }
};

export const deleteMusicSourceCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid category id' } });
    }

    const result = await pool.query('DELETE FROM music_source_categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    return res.json({ success: true, data: { deleted_id: id } });
  } catch (error) {
    console.error('Delete music source category error:', error);
    return res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete category' } });
  }
};

export const getMusicSourceNodes = async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.query.game_id);
    const categoryId = Number(req.query.category_id);
    const parentRaw = req.query.parent_id;

    if (!Number.isInteger(gameId) || gameId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'game_id and category_id must be positive integers' },
      });
    }

    let parentId: number | null = null;
    if (parentRaw !== undefined) {
      if (String(parentRaw).trim() === '') {
        parentId = null;
      } else {
        const parsed = Number(parentRaw);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return res.status(400).json({ success: false, error: { code: 'INVALID_PARENT_ID', message: 'parent_id must be positive integer or omitted' } });
        }
        parentId = parsed;
      }
    }

    const result = await pool.query(
      `SELECT id, uuid::text AS uuid, game_id, category_id, parent_id, name, display_order, created_at, updated_at
       FROM music_source_nodes
       WHERE game_id = $1
         AND category_id = $2
         AND ((parent_id IS NULL AND $3::int IS NULL) OR parent_id = $3)
       ORDER BY display_order ASC, name ASC`,
      [gameId, categoryId, parentId]
    );

    return res.json({ success: true, data: { nodes: result.rows } });
  } catch (error) {
    console.error('Get music source nodes error:', error);
    return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch nodes' } });
  }
};

export const createMusicSourceNode = async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.body.game_id);
    const categoryId = Number(req.body.category_id);
    const parentId = req.body.parent_id == null ? null : Number(req.body.parent_id);
    const name = String(req.body.name || '').trim();
    const displayOrder = Number.isInteger(req.body.display_order) ? Number(req.body.display_order) : 0;

    if (!Number.isInteger(gameId) || gameId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0 || !name) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'game_id, category_id and name are required' } });
    }

    if (parentId != null) {
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PARENT_ID', message: 'parent_id must be a positive integer' } });
      }
      const parentResult = await pool.query(
        'SELECT id FROM music_source_nodes WHERE id = $1 AND game_id = $2 AND category_id = $3',
        [parentId, gameId, categoryId]
      );
      if (parentResult.rows.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent node not found in same game/category' } });
      }
    }

    const result = await pool.query(
      `INSERT INTO music_source_nodes (game_id, category_id, parent_id, name, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, uuid::text AS uuid, game_id, category_id, parent_id, name, display_order, created_at, updated_at`,
      [gameId, categoryId, parentId, name, displayOrder]
    );

    return res.status(201).json({ success: true, data: { node: result.rows[0] } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Node already exists under this parent' } });
    }
    console.error('Create music source node error:', error);
    return res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create node' } });
  }
};

export const updateMusicSourceNode = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || '').trim();
    const displayOrder = Number.isInteger(req.body.display_order) ? Number(req.body.display_order) : 0;

    if (!Number.isInteger(id) || id <= 0 || !name) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'id and name are required' } });
    }

    const result = await pool.query(
      `UPDATE music_source_nodes
       SET name = $1, display_order = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, uuid::text AS uuid, game_id, category_id, parent_id, name, display_order, created_at, updated_at`,
      [name, displayOrder, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    return res.json({ success: true, data: { node: result.rows[0] } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Node already exists under this parent' } });
    }
    console.error('Update music source node error:', error);
    return res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update node' } });
  }
};

export const deleteMusicSourceNode = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid node id' } });
    }

    const result = await pool.query('DELETE FROM music_source_nodes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }

    return res.json({ success: true, data: { deleted_id: id } });
  } catch (error) {
    console.error('Delete music source node error:', error);
    return res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete node' } });
  }
};

export const getTrackMusicSources = async (req: Request, res: Response) => {
  try {
    const trackId = Number(req.params.trackId);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TRACK_ID', message: 'Invalid track id' } });
    }

    const rows = await pool.query(
      `SELECT
         tms.id,
         tms.track_id,
         tms.game_id,
         g.name AS game_name,
         tms.category_id,
         c.name AS category_name,
         tms.node_id,
         n.name AS node_name,
         tms.display_order,
         tms.created_at,
         tms.updated_at
       FROM track_music_sources tms
       LEFT JOIN games g ON g.id = tms.game_id
       JOIN music_source_categories c ON c.id = tms.category_id
       JOIN music_source_nodes n ON n.id = tms.node_id
       WHERE tms.track_id = $1
       ORDER BY tms.display_order ASC, tms.id ASC`,
      [trackId]
    );

    const nodeLookup = await listAllNodes();

    const items = rows.rows.map((row: any) => ({
      ...row,
      path: buildPathSegments(Number(row.node_id), nodeLookup),
    }));

    return res.json({ success: true, data: { items } });
  } catch (error) {
    console.error('Get track music sources error:', error);
    return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch track music sources' } });
  }
};

export const upsertTrackMusicSources = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const trackId = Number(req.params.trackId);
    const conflictMode = normalizeConflictMode(req.body?.conflict_mode);
    const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];

    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TRACK_ID', message: 'Invalid track id' } });
    }
    if (sources.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'sources cannot be empty' } });
    }

    await client.query('BEGIN');

    const trackResult = await client.query('SELECT id FROM tracks WHERE id = $1', [trackId]);
    if (trackResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Track not found' } });
    }

    const normalized = [] as Array<{ game_id: number; category_id: number; node_id: number; display_order: number }>;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i] as Record<string, unknown>;
      const gameId = Number(source.game_id);
      const categoryId = Number(source.category_id);
      const nodeId = Number(source.node_id);
      const displayOrder = Number.isInteger(source.display_order) ? Number(source.display_order) : i;
      if (!Number.isInteger(gameId) || gameId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0 || !Number.isInteger(nodeId) || nodeId <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'Each source requires valid game_id, category_id and node_id' } });
      }

      const nodeResult = await client.query(
        'SELECT id FROM music_source_nodes WHERE id = $1 AND game_id = $2 AND category_id = $3',
        [nodeId, gameId, categoryId]
      );
      if (nodeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: { code: 'INVALID_SOURCE_NODE', message: `Invalid node for source index ${i}` } });
      }

      normalized.push({ game_id: gameId, category_id: categoryId, node_id: nodeId, display_order: displayOrder });
    }

    const existingResult = await client.query('SELECT COUNT(*)::int AS cnt FROM track_music_sources WHERE track_id = $1', [trackId]);
    const existingCount = Number(existingResult.rows[0]?.cnt || 0);

    if (conflictMode === 'skip' && existingCount > 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, data: { status: 'skipped', message: 'Track already has music sources' } });
    }

    if (conflictMode === 'overwrite') {
      await client.query('DELETE FROM track_music_sources WHERE track_id = $1', [trackId]);
    }

    for (const source of normalized) {
      await client.query(
        `INSERT INTO track_music_sources (track_id, game_id, category_id, node_id, display_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (track_id, node_id) DO UPDATE
         SET game_id = EXCLUDED.game_id,
             category_id = EXCLUDED.category_id,
             display_order = EXCLUDED.display_order,
             updated_at = CURRENT_TIMESTAMP`,
        [trackId, source.game_id, source.category_id, source.node_id, source.display_order]
      );
    }

    await client.query('COMMIT');
    return res.json({ success: true, data: { status: 'imported', imported_count: normalized.length } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upsert track music sources error:', error);
    return res.status(500).json({ success: false, error: { code: 'SAVE_ERROR', message: 'Failed to save track music sources' } });
  } finally {
    client.release();
  }
};

export const getMusicSourceImportCandidates = async (req: Request, res: Response) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const requestedLimit = Number.parseInt(String(req.query.limit || '30'), 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;

    if (keyword) {
      const candidates = await searchTrackCandidatesForMusicSourceImport(keyword, limit);
      return res.json({ success: true, data: { candidates } });
    }

    const songName = String(req.query.song_name || '').trim();
    const trackNumber = normalizeTrackNumber(req.query.song_number);
    if (!songName || !trackNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'keyword or song_name + song_number are required' },
      });
    }

    const candidates = await queryTrackCandidates(songName, trackNumber);
    return res.json({ success: true, data: { candidates } });
  } catch (error) {
    console.error('Get music source import candidates error:', error);
    return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch candidates' } });
  }
};

export const previewMusicSourceImport = async (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as MusicSourceImportEntry[]) : [];
    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_ENTRIES', message: 'No import entries provided' } });
    }

    const items: MusicSourceImportItem[] = [];

    for (const entry of entries) {
      const resolved = await resolveImportEntry(entry, {});
      items.push({
        row_key: entry.row_key,
        song_name: String(entry.song_name || '').trim(),
        song_number_raw: entry.song_number == null ? '' : String(entry.song_number).trim(),
        status: resolved.status,
        message: appendImportWarnings(resolved.message, resolved.has_empty_sources),
        matched_track_id: resolved.matched_track_id,
        source_count: Array.isArray(entry.sources) ? entry.sources.length : 0,
        candidates: resolved.candidates,
      });
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          matched: items.filter((item) => item.status === 'matched').length,
          needs_manual: items.filter((item) => item.status === 'needs_manual').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Preview music source import error:', error);
    return res.status(500).json({ success: false, error: { code: 'PREVIEW_ERROR', message: 'Failed to preview music source import' } });
  }
};

export const commitMusicSourceImport = async (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as MusicSourceImportEntry[]) : [];
    const resolutions = req.body?.resolutions && typeof req.body.resolutions === 'object'
      ? (req.body.resolutions as Record<string, number>)
      : {};
    const conflictMode = normalizeConflictMode(req.body?.conflict_mode);

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_ENTRIES', message: 'No import entries provided' } });
    }

    const items: MusicSourceImportItem[] = [];

    for (const entry of entries) {
      const resolved = await resolveImportEntry(entry, resolutions);
      const baseItem: MusicSourceImportItem = {
        row_key: entry.row_key,
        song_name: String(entry.song_name || '').trim(),
        song_number_raw: entry.song_number == null ? '' : String(entry.song_number).trim(),
        status: resolved.status,
        message: appendImportWarnings(resolved.message, resolved.has_empty_sources),
        matched_track_id: resolved.matched_track_id,
        source_count: Array.isArray(entry.sources) ? entry.sources.length : 0,
        candidates: resolved.candidates,
      };

      if (resolved.status === 'invalid' || resolved.status === 'not_found' || resolved.status === 'needs_manual') {
        items.push(baseItem);
        continue;
      }

      if (!resolved.matched_track_id) {
        items.push({ ...baseItem, status: 'error', message: 'Resolved track id is missing' });
        continue;
      }

      if (resolved.has_empty_sources) {
        items.push({ ...baseItem, status: 'skipped', message: 'sources is empty; skipped without writing changes' });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existingResult = await client.query('SELECT COUNT(*)::int AS cnt FROM track_music_sources WHERE track_id = $1', [resolved.matched_track_id]);
        const existingCount = Number(existingResult.rows[0]?.cnt || 0);

        if (conflictMode === 'skip' && existingCount > 0) {
          await client.query('ROLLBACK');
          items.push({ ...baseItem, status: 'skipped', message: 'Track already has music sources, skipped by conflict mode' });
          continue;
        }

        if (conflictMode === 'overwrite') {
          await client.query('DELETE FROM track_music_sources WHERE track_id = $1', [resolved.matched_track_id]);
        }

        const normalizedSources = resolved.normalized_sources;
        const sourceNodeIds: number[] = [];
        for (const source of normalizedSources) {
          const nodeId = await ensureSourcePathNode(client, Number(entry.game_id), source);
          sourceNodeIds.push(nodeId);
        }
        const uniqueNodeIds = Array.from(new Set(sourceNodeIds));
        for (let i = 0; i < uniqueNodeIds.length; i++) {
          const nodeId = uniqueNodeIds[i];
          const nodeCheck = await client.query(
            'SELECT game_id, category_id FROM music_source_nodes WHERE id = $1',
            [nodeId]
          );
          if (nodeCheck.rows.length === 0) {
            throw new Error(`Source node not found: ${nodeId}`);
          }

          await client.query(
            `INSERT INTO track_music_sources (track_id, game_id, category_id, node_id, display_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (track_id, node_id) DO UPDATE
             SET game_id = EXCLUDED.game_id,
                 category_id = EXCLUDED.category_id,
                 display_order = EXCLUDED.display_order,
                 updated_at = CURRENT_TIMESTAMP`,
            [
              resolved.matched_track_id,
              Number(nodeCheck.rows[0].game_id),
              Number(nodeCheck.rows[0].category_id),
              nodeId,
              i,
            ]
          );
        }

        await client.query('COMMIT');
        items.push({ ...baseItem, status: 'imported', message: 'Music sources imported successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Commit music source import item error:', error);
        items.push({ ...baseItem, status: 'error', message: 'Failed to save music sources to database' });
      } finally {
        client.release();
      }
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          imported: items.filter((item) => item.status === 'imported').length,
          skipped: items.filter((item) => item.status === 'skipped').length,
          needs_manual: items.filter((item) => item.status === 'needs_manual').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
          error: items.filter((item) => item.status === 'error').length,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Commit music source import error:', error);
    return res.status(500).json({ success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to import music sources' } });
  }
};

export const exportMusicSources = async (req: Request, res: Response) => {
  try {
    const scope = String(req.body?.scope || 'all');
    const gameIds = Array.isArray(req.body?.game_ids)
      ? Array.from(new Set(req.body.game_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)))
      : [];
    const albumIds = Array.isArray(req.body?.album_ids)
      ? Array.from(new Set(req.body.album_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)))
      : [];
    const categoryIds = Array.isArray(req.body?.category_ids)
      ? Array.from(new Set(req.body.category_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)))
      : [];

    const whereParts: string[] = [];
    const params: any[] = [];

    if (scope === 'by_game') {
      if (gameIds.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SCOPE_FILTER', message: 'game_ids is required for by_game export' } });
      }
      params.push(gameIds);
      whereParts.push(`tms.game_id = ANY($${params.length}::int[])`);
    } else if (scope === 'by_album') {
      if (albumIds.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SCOPE_FILTER', message: 'album_ids is required for by_album export' } });
      }
      params.push(albumIds);
      whereParts.push(`t.album_id = ANY($${params.length}::int[])`);
    } else if (scope === 'by_category') {
      if (categoryIds.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SCOPE_FILTER', message: 'category_ids is required for by_category export' } });
      }
      params.push(categoryIds);
      whereParts.push(`tms.category_id = ANY($${params.length}::int[])`);
    } else if (scope !== 'all') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SCOPE', message: 'scope must be one of all | by_game | by_album | by_category' } });
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         tms.track_id,
         COALESCE(t.title_en, '') AS song_name,
         t.track_number AS song_number,
         COALESCE(a.title_en, '') AS album_name,
         tms.game_id,
         COALESCE(g.name, '') AS game_name,
         tms.category_id,
         c.uuid::text AS category_uuid,
         c.name AS category_name,
         tms.node_id
       FROM track_music_sources tms
       JOIN tracks t ON t.id = tms.track_id
       LEFT JOIN albums a ON a.id = t.album_id
       LEFT JOIN games g ON g.id = tms.game_id
       JOIN music_source_categories c ON c.id = tms.category_id
       ${whereSql}
       ORDER BY COALESCE(a.title, '') ASC, t.track_number ASC NULLS LAST, t.id ASC, tms.display_order ASC, tms.id ASC`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NO_DATA', message: 'No music sources found for export scope' } });
    }

    const nodeLookup = await listAllNodes();
    const grouped = new Map<string, {
      track_id: number;
      album_name: string;
      song_name: string;
      song_number: string;
      game_id: number;
      game_name: string;
      sources: Array<{ category: string; category_uuid?: string; path: string[]; path_node_uuids?: string[]; node_uuid?: string }>;
    }>();

    for (const row of result.rows as any[]) {
      const key = `${row.track_id}:${row.game_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          track_id: Number(row.track_id),
          album_name: String(row.album_name || ''),
          song_name: String(row.song_name || ''),
          song_number: row.song_number == null ? '' : String(row.song_number).padStart(2, '0'),
          game_id: Number(row.game_id),
          game_name: String(row.game_name || ''),
          sources: [],
        });
      }

      grouped.get(key)?.sources.push({
        category: String(row.category_name || ''),
        category_uuid: row.category_uuid ? String(row.category_uuid) : undefined,
        path: buildPathSegments(Number(row.node_id), nodeLookup),
        path_node_uuids: buildPathNodeUuids(Number(row.node_id), nodeLookup),
        node_uuid: nodeLookup.get(Number(row.node_id))?.uuid,
      });
    }

    const payload = {
      version: '1.0',
      scope,
      entries: Array.from(grouped.values()),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `music-sources-export-${scope}-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Export music sources error:', error);
    return res.status(500).json({ success: false, error: { code: 'EXPORT_ERROR', message: 'Failed to export music sources' } });
  }
};



