import { Request, Response } from 'express';
import pool from '../config/database';

// Create playlist
export const createPlaylist = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Playlist name is required' },
      });
    }

    const result = await pool.query(
      `INSERT INTO playlists (user_id, name, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, name.trim(), description || null, false]
    );

    res.status(201).json({ success: true, data: { playlist: result.rows[0] } });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create playlist' } });
  }
};

// Get all playlists for current user
export const getPlaylists = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    const result = await pool.query(
      `SELECT p.*,
              COUNT(pt.track_id)::int AS track_count,
              COALESCE(SUM(t.duration), 0)::int AS total_duration
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
       LEFT JOIN tracks t ON pt.track_id = t.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [user.id]
    );

    res.json({ success: true, data: { playlists: result.rows } });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch playlists' } });
  }
};

// Get playlist detail with tracks
export const getPlaylistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    const playlistResult = await pool.query(
      `SELECT p.*,
              COUNT(pt.track_id)::int AS track_count,
              COALESCE(SUM(t.duration), 0)::int AS total_duration
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
       LEFT JOIN tracks t ON pt.track_id = t.id
       WHERE p.id = $1 AND p.user_id = $2
       GROUP BY p.id`,
      [id, user.id]
    );

    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    const tracksResult = await pool.query(
      `SELECT t.*,
              a.title AS album_title,
              a.cover_path AS album_cover,
              pt.position,
              pt.added_at,
              COUNT(DISTINCT fav.user_id)::int AS favorite_count,
              array_agg(json_build_object('id', ar.id, 'name', ar.name)) AS artists
       FROM playlist_tracks pt
       JOIN tracks t ON pt.track_id = t.id
       LEFT JOIN albums a ON t.album_id = a.id
       LEFT JOIN favorites fav ON t.id = fav.track_id
       LEFT JOIN track_artists ta ON t.id = ta.track_id
       LEFT JOIN artists ar ON ta.artist_id = ar.id
       WHERE pt.playlist_id = $1
       GROUP BY t.id, a.title, a.cover_path, pt.position, pt.added_at
       ORDER BY pt.position ASC, pt.added_at ASC`,
      [id]
    );

    const tracks = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    res.json({
      success: true,
      data: {
        playlist: playlistResult.rows[0],
        tracks,
      },
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch playlist' } });
  }
};

// Update playlist
export const updatePlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const { name, description } = req.body;

    const result = await pool.query(
      `UPDATE playlists
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_public = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, description, id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    res.json({ success: true, data: { playlist: result.rows[0] } });
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update playlist' } });
  }
};

// Delete playlist
export const deletePlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    const result = await pool.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    res.json({ success: true, data: { message: 'Playlist deleted' } });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete playlist' } });
  }
};

// Add track to playlist
export const addTrackToPlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { trackId } = req.body;
    const user = req.user as any;

    // Verify ownership
    const ownerCheck = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    // Get max position
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM playlist_tracks WHERE playlist_id = $1',
      [id]
    );

    const result = await pool.query(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, track_id) DO NOTHING
       RETURNING *`,
      [id, trackId, maxPos.rows[0].next_pos]
    );

    // Update playlist timestamp
    await pool.query('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Track already in playlist' } });
    }

    res.status(201).json({ success: true, data: { message: 'Track added to playlist' } });
  } catch (error) {
    console.error('Add track to playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'ADD_ERROR', message: 'Failed to add track' } });
  }
};

// Remove track from playlist
export const removeTrackFromPlaylist = async (req: Request, res: Response) => {
  try {
    const { id, trackId } = req.params;
    const user = req.user as any;

    const ownerCheck = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2', [id, trackId]);
    await pool.query('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    res.json({ success: true, data: { message: 'Track removed from playlist' } });
  } catch (error) {
    console.error('Remove track from playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'REMOVE_ERROR', message: 'Failed to remove track' } });
  }
};

// Reorder tracks in playlist
export const reorderPlaylistTracks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { trackIds } = req.body; // ordered array of track IDs
    const user = req.user as any;

    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'trackIds array required' } });
    }

    const ownerCheck = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < trackIds.length; i++) {
        await client.query(
          'UPDATE playlist_tracks SET position = $1 WHERE playlist_id = $2 AND track_id = $3',
          [i + 1, id, trackIds[i]]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, data: { message: 'Playlist reordered' } });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    res.status(500).json({ success: false, error: { code: 'REORDER_ERROR', message: 'Failed to reorder playlist' } });
  }
};

