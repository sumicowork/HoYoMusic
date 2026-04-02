import { Request, Response } from 'express';
import pool from '../config/database';

type ConflictMode = 'overwrite' | 'append' | 'skip';
type ImportStatus = 'matched' | 'needs_manual' | 'not_found' | 'invalid' | 'imported' | 'skipped' | 'error';

interface MusicSourceNodeRecord {
  id: number;
  game_id: number;
  category_id: number;
  parent_id: number | null;
  name: string;
}

interface MusicSourceImportSource {
  category: string;
  path: string[];
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

const resolveSourcePath = async (gameId: number, source: MusicSourceImportSource): Promise<{ nodeId?: number; message?: string }> => {
  const categoryName = String(source.category || '').trim();
  const pathSegments = Array.isArray(source.path)
    ? source.path.map((segment) => String(segment || '').trim()).filter(Boolean)
    : [];

  if (!categoryName) {
    return { message: 'source.category is required' };
  }
  if (pathSegments.length === 0) {
    return { message: 'source.path cannot be empty' };
  }

  const categoryResult = await pool.query(
    'SELECT id FROM music_source_categories WHERE game_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1',
    [gameId, categoryName]
  );
  if (categoryResult.rows.length === 0) {
    return { message: `Category not found in game ${gameId}: ${categoryName}` };
  }

  const categoryId = Number(categoryResult.rows[0].id);
  let parentId: number | null = null;
  let currentNodeId: number | null = null;

  for (const segment of pathSegments) {
    const nodeResult: { rows: Array<{ id: number }> } = await pool.query(
      `SELECT id
       FROM music_source_nodes
       WHERE game_id = $1
         AND category_id = $2
         AND ((parent_id IS NULL AND $3::int IS NULL) OR parent_id = $3)
         AND LOWER(TRIM(name)) = LOWER(TRIM($4))
       LIMIT 1`,
      [gameId, categoryId, parentId, segment]
    );

    if (nodeResult.rows.length === 0) {
      return { message: `Path node not found: ${categoryName} / ${pathSegments.join(' / ')}` };
    }

    currentNodeId = Number(nodeResult.rows[0].id);
    parentId = currentNodeId;
  }

  if (!currentNodeId) {
    return { message: 'Unable to resolve source node' };
  }

  return { nodeId: currentNodeId };
};

const resolveImportEntry = async (
  entry: MusicSourceImportEntry,
  resolutions: Record<string, number>
): Promise<{ status: 'matched' | 'needs_manual' | 'not_found' | 'invalid'; matched_track_id?: number; message?: string; candidates?: Array<{ track_id: number; title: string; track_number: number | null; album_title: string; artists: string }>; sourceNodeIds: number[] }> => {
  const songName = String(entry.song_name || '').trim();
  const trackNumber = normalizeTrackNumber(entry.song_number);
  const gameId = Number(entry.game_id);
  const albumName = String(entry.album_name || '').trim();
  const sources = Array.isArray(entry.sources) ? entry.sources : [];

  if (!songName) return { status: 'invalid', message: 'song_name is required', sourceNodeIds: [] };
  if (!trackNumber) return { status: 'invalid', message: 'song_number is required for matching', sourceNodeIds: [] };
  if (!Number.isInteger(gameId) || gameId <= 0) return { status: 'invalid', message: 'game_id must be positive integer', sourceNodeIds: [] };
  if (sources.length === 0) return { status: 'invalid', message: 'sources cannot be empty', sourceNodeIds: [] };

  const sourceNodeIds: number[] = [];
  for (const source of sources) {
    const resolvedSource = await resolveSourcePath(gameId, source);
    if (!resolvedSource.nodeId) {
      return { status: 'invalid', message: resolvedSource.message || 'Invalid source path', sourceNodeIds: [] };
    }
    sourceNodeIds.push(resolvedSource.nodeId);
  }

  const selectedTrackId = Number(resolutions[entry.row_key]);
  if (Number.isInteger(selectedTrackId) && selectedTrackId > 0) {
    const selectedCandidate = await queryTrackById(selectedTrackId);
    if (selectedCandidate) {
      return {
        status: 'matched',
        matched_track_id: selectedCandidate.track_id,
        candidates: [selectedCandidate],
        sourceNodeIds,
      };
    }
  }

  const candidates = await queryTrackCandidates(songName, trackNumber);
  if (candidates.length === 0) {
    return { status: 'not_found', message: 'No track found by song_name + song_number', sourceNodeIds };
  }
  if (candidates.length === 1) {
    return { status: 'matched', matched_track_id: candidates[0].track_id, candidates, sourceNodeIds };
  }

  if (albumName) {
    const albumMatched = candidates.filter((candidate) => candidate.album_title.trim().toLowerCase() === albumName.toLowerCase());
    if (albumMatched.length === 1) {
      return { status: 'matched', matched_track_id: albumMatched[0].track_id, candidates: albumMatched, sourceNodeIds };
    }
  }

  const selectedCandidate = candidates.find((candidate) => candidate.track_id === selectedTrackId);
  if (selectedCandidate) {
    return { status: 'matched', matched_track_id: selectedCandidate.track_id, candidates, sourceNodeIds };
  }

  return {
    status: 'needs_manual',
    message: 'Multiple tracks matched song_name + song_number. Please resolve manually.',
    candidates,
    sourceNodeIds,
  };
};

const listAllNodes = async (): Promise<Map<number, MusicSourceNodeRecord>> => {
  const result = await pool.query<MusicSourceNodeRecord>(
    'SELECT id, game_id, category_id, parent_id, name FROM music_source_nodes'
  );
  const lookup = new Map<number, MusicSourceNodeRecord>();
  for (const row of result.rows) {
    lookup.set(Number(row.id), {
      id: Number(row.id),
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
      `SELECT id, game_id, name, description, display_order, created_at, updated_at
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
       RETURNING id, game_id, name, description, display_order, created_at, updated_at`,
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
       RETURNING id, game_id, name, description, display_order, created_at, updated_at`,
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
      `SELECT id, game_id, category_id, parent_id, name, display_order, created_at, updated_at
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
       RETURNING id, game_id, category_id, parent_id, name, display_order, created_at, updated_at`,
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
       RETURNING id, game_id, category_id, parent_id, name, display_order, created_at, updated_at`,
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
        message: resolved.message,
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
        message: resolved.message,
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

        const uniqueNodeIds = Array.from(new Set(resolved.sourceNodeIds));
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
    } else if (scope !== 'all') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SCOPE', message: 'scope must be one of all | by_game | by_album' } });
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
      sources: Array<{ category: string; path: string[] }>;
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
        path: buildPathSegments(Number(row.node_id), nodeLookup),
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


