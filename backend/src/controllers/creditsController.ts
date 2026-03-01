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

type ImportResultStatus = 'imported' | 'skipped' | 'not_found' | 'ambiguous' | 'error';

interface ImportResultItem {
  album: string;
  track: string;
  status: ImportResultStatus;
  imported_count?: number;
  message?: string;
}

// Get credits for a track
export const getCredits = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, credit_key, credit_value, display_order 
       FROM track_credits 
       WHERE track_id = $1 
       ORDER BY display_order ASC, id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        credits: result.rows
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

