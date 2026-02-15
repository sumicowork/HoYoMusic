import { Request, Response } from 'express';
import pool from '../config/database';

// Get all artists with track count
export const getArtists = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';

    let searchCondition = '';
    const queryParams: any[] = [limit, offset];

    if (search) {
      searchCondition = 'WHERE LOWER(ar.name) LIKE LOWER($3)';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM artists ar
      ${searchCondition}
    `;
    const countResult = await pool.query(countQuery, search ? [queryParams[2]] : []);
    const total = parseInt(countResult.rows[0].count);

    // Get artists with track count
    const artistsQuery = `
      SELECT 
        ar.*,
        COUNT(DISTINCT ta.track_id) as track_count,
        COUNT(DISTINCT t.album_id) as album_count
      FROM artists ar
      LEFT JOIN track_artists ta ON ar.id = ta.artist_id
      LEFT JOIN tracks t ON ta.track_id = t.id
      ${searchCondition}
      GROUP BY ar.id
      ORDER BY ar.name ASC
      LIMIT $1 OFFSET $2
    `;

    const artistsResult = await pool.query(artistsQuery, queryParams);

    res.json({
      success: true,
      data: {
        artists: artistsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch artists' }
    });
  }
};

// Get artist by ID with all tracks
export const getArtistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get artist info
    const artistQuery = `
      SELECT 
        ar.*,
        COUNT(DISTINCT ta.track_id) as track_count,
        COUNT(DISTINCT t.album_id) as album_count
      FROM artists ar
      LEFT JOIN track_artists ta ON ar.id = ta.artist_id
      LEFT JOIN tracks t ON ta.track_id = t.id
      WHERE ar.id = $1
      GROUP BY ar.id
    `;
    const artistResult = await pool.query(artistQuery, [id]);

    if (artistResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artist not found' }
      });
    }

    const artist = artistResult.rows[0];

    // Get all tracks by this artist
    const tracksQuery = `
      SELECT 
        t.*,
        a.title as album_title,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.id IN (
        SELECT track_id FROM track_artists WHERE artist_id = $1
      )
      GROUP BY t.id, a.title
      ORDER BY t.created_at DESC
    `;
    const tracksResult = await pool.query(tracksQuery, [id]);

    const tracks = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    // Get albums by this artist
    const albumsQuery = `
      SELECT DISTINCT
        a.*,
        COUNT(DISTINCT t2.id) as track_count
      FROM albums a
      INNER JOIN tracks t ON a.id = t.album_id
      INNER JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN tracks t2 ON a.id = t2.album_id
      WHERE ta.artist_id = $1
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `;
    const albumsResult = await pool.query(albumsQuery, [id]);

    res.json({
      success: true,
      data: {
        artist,
        tracks,
        albums: albumsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get artist by ID error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch artist details' }
    });
  }
};

// Update artist
export const updateArtist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const result = await pool.query(
      `UPDATE artists 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artist not found' }
      });
    }

    res.json({
      success: true,
      data: { artist: result.rows[0] },
    });
  } catch (error) {
    console.error('Update artist error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update artist' }
    });
  }
};

