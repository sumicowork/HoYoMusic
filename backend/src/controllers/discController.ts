import { Request, Response } from 'express';
import pool from '../config/database';
import { cache } from '../utils/cache';

// Get all discs for an album
export const getDiscsByAlbum = async (req: Request, res: Response) => {
  try {
    const { albumId } = req.params;
    const result = await pool.query(
      `SELECT * FROM album_discs WHERE album_id = $1 ORDER BY disc_number ASC`,
      [albumId]
    );
    res.json({ success: true, data: { discs: result.rows } });
  } catch (error) {
    console.error('Get discs error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch discs' } });
  }
};

// Create a disc for an album
export const createDisc = async (req: Request, res: Response) => {
  try {
    const { albumId } = req.params;
    const { disc_number, disc_title } = req.body;

    const result = await pool.query(
      `INSERT INTO album_discs (album_id, disc_number, disc_title) VALUES ($1, $2, $3) RETURNING *`,
      [albumId, disc_number, disc_title || null]
    );

    cache.invalidatePattern('albums');
    res.json({ success: true, data: { disc: result.rows[0] } });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: '该碟片编号已存在' } });
    }
    console.error('Create disc error:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create disc' } });
  }
};

// Update a disc
export const updateDisc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { disc_number, disc_title } = req.body;

    const result = await pool.query(
      `UPDATE album_discs SET disc_number = $1, disc_title = $2 WHERE id = $3 RETURNING *`,
      [disc_number, disc_title || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Disc not found' } });
    }

    cache.invalidatePattern('albums');
    res.json({ success: true, data: { disc: result.rows[0] } });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: '该碟片编号已存在' } });
    }
    console.error('Update disc error:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update disc' } });
  }
};

// Delete a disc (tracks will have disc_id set to NULL)
export const deleteDisc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM album_discs WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Disc not found' } });
    }

    cache.invalidatePattern('albums');
    res.json({ success: true, data: { message: 'Disc deleted' } });
  } catch (error) {
    console.error('Delete disc error:', error);
    res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete disc' } });
  }
};

// Assign a track to a disc
export const assignTrackToDisc = async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { disc_id } = req.body;

    const result = await pool.query(
      `UPDATE tracks SET disc_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, disc_id`,
      [disc_id, trackId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Track not found' } });
    }

    cache.invalidatePattern('albums');
    res.json({ success: true, data: { track: result.rows[0] } });
  } catch (error) {
    console.error('Assign track to disc error:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to assign track to disc' } });
  }
};

// Bulk assign tracks to a disc
export const bulkAssignTracksToDisc = async (req: Request, res: Response) => {
  try {
    const { albumId } = req.params;
    const { assignments } = req.body; // Array of { track_id, disc_id }

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'assignments must be an array' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { track_id, disc_id } of assignments) {
        await client.query(
          `UPDATE tracks SET disc_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND album_id = $3`,
          [disc_id || null, track_id, albumId]
        );
      }
      await client.query('COMMIT');
      cache.invalidatePattern('albums');
      res.json({ success: true, data: { message: `Updated ${assignments.length} tracks` } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Bulk assign tracks error:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to bulk assign tracks' } });
  }
};

