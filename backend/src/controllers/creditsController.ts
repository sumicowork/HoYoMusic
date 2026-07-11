import { Request, Response } from 'express';
import pool from '../config/database';

// ── Types for import ──────────────────────────────────────────────────────────
interface ImportCreditEntry {
  key: string;
  value: string;
  order?: number;
}

interface ImportTrackEntry {
  album: string;
  track: string;
  conflict_mode?: 'append' | 'overwrite' | 'skip';
  credits: ImportCreditEntry[];
}

interface ImportFile {
  version?: string;
  conflict_mode?: 'append' | 'overwrite' | 'skip';
  tracks: ImportTrackEntry[];
}

interface ExportCreditsRequestBody {
  albumIds?: number[];
}

interface ExportQueryRow {
  album_title: string;
  track_id: number;
  track_title: string;
  credit_key: string;
  credit_value: string;
  display_order: number;
}

// Cache: lowercased person name -> artist id (canonical + alias names).
// Lets the credits endpoint return a stable artist_id per person for jumps.
let _nameToArtistId: Map<string, number> | null = null;
let _nameToArtistIdAt = 0;
async function getNameToArtistId(): Promise<Map<string, number>> {
  const now = Date.now();
  if (_nameToArtistId && now - _nameToArtistIdAt < 60_000) return _nameToArtistId;
  const artists = await pool.query<{ id: number; name: string }>('SELECT id, name FROM artists');
  const aliases = await pool.query<{ canonical_name: string; alias_name: string }>(
    'SELECT canonical_name, alias_name FROM artist_aliases'
  );
  const byName = new Map<string, number>();
  for (const a of artists.rows) byName.set(a.name.trim().toLowerCase(), a.id);
  const map = new Map<string, number>(byName);
  for (const al of aliases.rows) {
    const cid = byName.get(al.canonical_name.trim().toLowerCase());
    if (cid != null) map.set(al.alias_name.trim().toLowerCase(), cid);
  }
  _nameToArtistId = map;
  _nameToArtistIdAt = now;
  return map;
}

const parsePeople = (value: string): string[] =>
  String(value || '')
    .split(/\s*(?:\/|、|,|，|;|；|&|＆|\||｜|\+|＋)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);


type ImportResultStatus = 'imported' | 'skipped' | 'not_found' | 'ambiguous' | 'error';

interface ImportResultItem {
  album: string;
  track: string;
  status: ImportResultStatus;
  imported_count?: number;
  message?: string;
}

const parseAlbumIds = (body: ExportCreditsRequestBody): number[] | null => {
  if (!Array.isArray(body.albumIds) || body.albumIds.length === 0) {
    return null;
  }

  const normalized = body.albumIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalized.length !== body.albumIds.length) {
    return null;
  }

  return Array.from(new Set(normalized));
};

// Get credits for a track
export const getCredits = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, credit_key, credit_value, display_order, artist_id
       FROM track_credits
       WHERE track_id = $1
       ORDER BY display_order ASC, id ASC`,
      [id]
    );

    const nameMap = await getNameToArtistId();
    const credits = result.rows.map((c: any) => ({
      ...c,
      people: parsePeople(c.credit_value).map((name: string) => ({
        name,
        artist_id: nameMap.get(name.toLowerCase()) ?? null,
      })),
    }));

    res.json({
      success: true,
      data: {
        credits
      }
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch credits' }
    });
  }
};

// Add credit
export const addCredit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { credit_key, credit_value, display_order } = req.body;

    if (!credit_key || !credit_value) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'credit_key and credit_value are required' }
      });
    }

    const result = await pool.query(
      `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, credit_key, credit_value, display_order`,
      [id, credit_key, credit_value, display_order || 0]
    );

    res.json({
      success: true,
      data: {
        credit: result.rows[0],
        message: 'Credit added successfully'
      }
    });
  } catch (error) {
    console.error('Add credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add credit' }
    });
  }
};

// Update credit
export const updateCredit = async (req: Request, res: Response) => {
  try {
    const { id, creditId } = req.params;
    const { credit_key, credit_value, display_order } = req.body;

    const result = await pool.query(
      `UPDATE track_credits 
       SET credit_key = $1, credit_value = $2, display_order = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND track_id = $5
       RETURNING id, credit_key, credit_value, display_order`,
      [credit_key, credit_value, display_order, creditId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Credit not found' }
      });
    }

    res.json({
      success: true,
      data: {
        credit: result.rows[0],
        message: 'Credit updated successfully'
      }
    });
  } catch (error) {
    console.error('Update credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update credit' }
    });
  }
};

// Delete credit
export const deleteCredit = async (req: Request, res: Response) => {
  try {
    const { id, creditId } = req.params;

    const result = await pool.query(
      'DELETE FROM track_credits WHERE id = $1 AND track_id = $2 RETURNING id',
      [creditId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Credit not found' }
      });
    }

    res.json({
      success: true,
      data: { message: 'Credit deleted successfully' }
    });
  } catch (error) {
    console.error('Delete credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete credit' }
    });
  }
};

// Bulk import credits from JSON data file
export const importCredits = async (req: Request, res: Response) => {
  try {
    // Accept parsed JSON body (express.json middleware) or raw file upload buffer
    let importData: ImportFile;

    if (req.file) {
      // Uploaded as multipart file
      try {
        importData = JSON.parse(req.file.buffer.toString('utf-8'));
      } catch {
        return res.status(400).json({
          success: false,
          error: { code: 'PARSE_ERROR', message: '文件不是有效的 JSON 格式' }
        });
      }
    } else if (req.body && req.body.tracks) {
      importData = req.body as ImportFile;
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_DATA', message: '请提供 JSON 导入文件或 JSON 请求体' }
      });
    }

    // Validate top-level structure
    if (!Array.isArray(importData.tracks) || importData.tracks.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: '导入文件缺少 tracks 数组或数组为空' }
      });
    }

    const globalConflictMode = importData.conflict_mode ?? 'append';
    const results: ImportResultItem[] = [];

    for (const entry of importData.tracks) {
      const { album, track, credits, conflict_mode: entryConflictMode } = entry;
      const conflictMode = entryConflictMode ?? globalConflictMode;

      // Basic validation
      if (!album || !track) {
        results.push({ album: album ?? '', track: track ?? '', status: 'error', message: '缺少 album 或 track 字段' });
        continue;
      }
      if (!Array.isArray(credits) || credits.length === 0) {
        results.push({ album, track, status: 'error', message: 'credits 数组为空或缺失' });
        continue;
      }

      // Validate credit entries
      const invalidCredit = credits.find(c => !c.key || !c.value);
      if (invalidCredit) {
        results.push({ album, track, status: 'error', message: 'credits 中存在缺少 key 或 value 的条目' });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lookup track by album title + track title (case-insensitive)
        const lookupResult = await client.query(
          `SELECT t.id
           FROM tracks t
           JOIN albums a ON t.album_id = a.id
           WHERE LOWER(t.title) = LOWER($1) AND LOWER(a.title) = LOWER($2)`,
          [track, album]
        );

        if (lookupResult.rows.length === 0) {
          await client.query('ROLLBACK');
          results.push({ album, track, status: 'not_found', message: '数据库中未找到匹配的专辑/曲目' });
          continue;
        }

        if (lookupResult.rows.length > 1) {
          await client.query('ROLLBACK');
          results.push({ album, track, status: 'ambiguous', message: '同专辑下找到多首同名曲目，请修正文件后重试' });
          continue;
        }

        const trackId = lookupResult.rows[0].id;

        // Check existing credits
        const existingResult = await client.query(
          'SELECT COUNT(*) AS cnt FROM track_credits WHERE track_id = $1',
          [trackId]
        );
        const existingCount = parseInt(existingResult.rows[0].cnt, 10);

        if (conflictMode === 'skip' && existingCount > 0) {
          await client.query('ROLLBACK');
          results.push({ album, track, status: 'skipped', message: `已有 ${existingCount} 条 credits，已跳过` });
          continue;
        }

        if (conflictMode === 'overwrite' && existingCount > 0) {
          await client.query('DELETE FROM track_credits WHERE track_id = $1', [trackId]);
        }

        // Insert credits
        for (let i = 0; i < credits.length; i++) {
          const { key, value, order } = credits[i];
          const displayOrder = order !== undefined ? order : i;
          await client.query(
            `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order)
             VALUES ($1, $2, $3, $4)`,
            [trackId, key.trim(), value.trim(), displayOrder]
          );
        }

        await client.query('COMMIT');
        results.push({ album, track, status: 'imported', imported_count: credits.length });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Import credits error for "${album} / ${track}":`, err);
        results.push({ album, track, status: 'error', message: '写入数据库时发生错误' });
      } finally {
        client.release();
      }
    }

    const summary = {
      total: results.length,
      imported: results.filter(r => r.status === 'imported').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      not_found: results.filter(r => r.status === 'not_found').length,
      ambiguous: results.filter(r => r.status === 'ambiguous').length,
      error: results.filter(r => r.status === 'error').length,
    };

    res.json({
      success: true,
      data: { summary, results }
    });
  } catch (error) {
    console.error('Import credits error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_ERROR', message: 'Credits 导入失败' }
    });
  }
};

// Export credits in the same JSON shape used by credits import
export const exportCredits = async (req: Request, res: Response) => {
  try {
    const albumIds = parseAlbumIds(req.body as ExportCreditsRequestBody);
    if (!albumIds) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'albumIds 必须是非空数字数组' }
      });
    }

    const rowsResult = await pool.query<ExportQueryRow>(
      `SELECT
         a.title AS album_title,
         t.id AS track_id,
         t.title AS track_title,
         tc.credit_key,
         tc.credit_value,
         tc.display_order
       FROM albums a
       JOIN tracks t ON t.album_id = a.id
       JOIN track_credits tc ON tc.track_id = t.id
       WHERE a.id = ANY($1::int[])
       ORDER BY a.title ASC, t.track_number ASC NULLS LAST, t.id ASC, tc.display_order ASC, tc.id ASC`,
      [albumIds]
    );

    if (rowsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_CREDITS_FOUND', message: '所选专辑未找到可导出的 Credits' }
      });
    }

    const trackMap = new Map<number, ImportTrackEntry>();

    for (const row of rowsResult.rows) {
      const existingTrack = trackMap.get(row.track_id);
      if (!existingTrack) {
        trackMap.set(row.track_id, {
          album: row.album_title,
          track: row.track_title,
          credits: [
            {
              key: row.credit_key,
              value: row.credit_value,
              order: row.display_order,
            }
          ]
        });
        continue;
      }

      existingTrack.credits.push({
        key: row.credit_key,
        value: row.credit_value,
        order: row.display_order,
      });
    }

    const exportPayload: ImportFile = {
      version: '1.0',
      conflict_mode: 'append',
      tracks: Array.from(trackMap.values()),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `credits-export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (error) {
    console.error('Export credits error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Credits 导出失败' }
    });
  }
};

