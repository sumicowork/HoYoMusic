import { Request, Response } from 'express';
import pool from '../config/database';

// Toggle favorite (add if not exists, remove if exists)
export const toggleFavorite = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { trackId } = req.body;

    if (!trackId) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'trackId is required' } });
    }

    // Check if already favorited
    const existing = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND track_id = $2',
      [user.id, trackId]
    );

    if (existing.rows.length > 0) {
      // Remove
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND track_id = $2', [user.id, trackId]);
      return res.json({ success: true, data: { favorited: false, message: 'Removed from favorites' } });
    } else {
      // Add
      await pool.query(
        'INSERT INTO favorites (user_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, trackId]
      );
      return res.json({ success: true, data: { favorited: true, message: 'Added to favorites' } });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ success: false, error: { code: 'FAVORITE_ERROR', message: 'Failed to toggle favorite' } });
  }
};

// Get all favorites for current user
export const getFavorites = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM favorites WHERE user_id = $1',
      [user.id]
    );
    const total = countResult.rows[0].total;

    const result = await pool.query(
      `SELECT t.*,
              a.title AS album_title,
              a.cover_path AS album_cover,
              f.created_at AS favorited_at,
              COUNT(DISTINCT fav_all.user_id)::int AS favorite_count,
              array_agg(json_build_object('id', ar.id, 'name', ar.name)) AS artists
       FROM favorites f
       JOIN tracks t ON f.track_id = t.id
       LEFT JOIN albums a ON t.album_id = a.id
       LEFT JOIN favorites fav_all ON t.id = fav_all.track_id
       LEFT JOIN track_artists ta ON t.id = ta.track_id
       LEFT JOIN artists ar ON ta.artist_id = ar.id
       WHERE f.user_id = $1
       GROUP BY t.id, a.title, a.cover_path, f.created_at
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const tracks = result.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    res.json({
      success: true,
      data: {
        tracks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch favorites' } });
  }
};

// Check if tracks are favorited (bulk)
export const checkFavorites = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { trackIds } = req.body;

    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return res.json({ success: true, data: { favorites: {} } });
    }

    const result = await pool.query(
      'SELECT track_id FROM favorites WHERE user_id = $1 AND track_id = ANY($2)',
      [user.id, trackIds]
    );

    const favoritedSet: Record<number, boolean> = {};
    for (const row of result.rows) {
      favoritedSet[row.track_id] = true;
    }

    res.json({ success: true, data: { favorites: favoritedSet } });
  } catch (error) {
    console.error('Check favorites error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to check favorites' } });
  }
};

