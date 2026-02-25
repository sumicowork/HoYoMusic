import { Request, Response } from 'express';
import pool from '../config/database';

// Get all "artists" from track_credits (unique credit_value, with track count)
export const getArtists = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    const searchCond = search ? `AND LOWER(tc.credit_value) LIKE LOWER($3)` : '';
    const params: any[] = [limit, offset];
    if (search) params.push(`%${search}%`);

    const countQuery = `
      SELECT COUNT(DISTINCT tc.credit_value)
      FROM track_credits tc
      WHERE tc.credit_value IS NOT NULL AND tc.credit_value <> ''
      ${searchCond}
    `;
    const countResult = await pool.query(countQuery, search ? [params[2]] : []);
    const total = parseInt(countResult.rows[0].count);

    const artistsQuery = `
      SELECT
        tc.credit_value                         AS name,
        COUNT(DISTINCT tc.track_id)             AS track_count,
        COUNT(DISTINCT t.album_id)              AS album_count,
        array_agg(DISTINCT tc.credit_key)       AS roles
      FROM track_credits tc
      LEFT JOIN tracks t ON tc.track_id = t.id
      WHERE tc.credit_value IS NOT NULL AND tc.credit_value <> ''
      ${searchCond}
      GROUP BY tc.credit_value
      ORDER BY COUNT(DISTINCT tc.track_id) DESC, tc.credit_value ASC
      LIMIT $1 OFFSET $2
    `;
    const artistsResult = await pool.query(artistsQuery, params);

    res.json({
      success: true,
      data: {
        artists: artistsResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch artists' } });
  }
};

// Get "artist" detail: all tracks/albums where this person appears in credits
export const getArtistById = async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(String(req.params.id || ''));

    // Tracks featuring this person in credits
    const tracksQuery = `
      SELECT
        t.*,
        a.title  AS album_title,
        a.cover_path AS album_cover,
        array_agg(DISTINCT tc2.credit_key) AS roles,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) AS artists
      FROM track_credits tc
      JOIN tracks t         ON tc.track_id  = t.id
      LEFT JOIN albums a    ON t.album_id   = a.id
      LEFT JOIN track_credits tc2 ON tc2.track_id = t.id AND LOWER(tc2.credit_value) = LOWER($1)
      LEFT JOIN track_artists ta  ON t.id = ta.track_id
      LEFT JOIN artists ar        ON ta.artist_id = ar.id
      WHERE LOWER(tc.credit_value) = LOWER($1)
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY t.created_at DESC
    `;
    const tracksResult = await pool.query(tracksQuery, [name]);
    const tracks = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    // Albums
    const albumsQuery = `
      SELECT DISTINCT
        a.*,
        COUNT(DISTINCT t2.id) AS track_count
      FROM track_credits tc
      JOIN tracks t   ON tc.track_id = t.id
      JOIN albums a   ON t.album_id  = a.id
      LEFT JOIN tracks t2 ON a.id = t2.album_id
      WHERE LOWER(tc.credit_value) = LOWER($1)
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `;
    const albumsResult = await pool.query(albumsQuery, [name]);

    // Summary stats + roles
    const statsQuery = `
      SELECT
        COUNT(DISTINCT tc.track_id)       AS track_count,
        COUNT(DISTINCT t.album_id)        AS album_count,
        array_agg(DISTINCT tc.credit_key) AS roles
      FROM track_credits tc
      LEFT JOIN tracks t ON tc.track_id = t.id
      WHERE LOWER(tc.credit_value) = LOWER($1)
    `;
    const statsResult = await pool.query(statsQuery, [name]);
    const stats = statsResult.rows[0];

    if (parseInt(stats.track_count) === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artist not found' } });
    }

    res.json({
      success: true,
      data: {
        artist: {
          id: null,           // credits-based artists have no integer id
          name,
          track_count: stats.track_count,
          album_count: stats.album_count,
          roles: stats.roles.filter(Boolean),
        },
        tracks,
        albums: albumsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get artist by ID error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch artist details' } });
  }
};

// Update artist (keep for backward compat, now a no-op stub)
export const updateArtist = async (req: Request, res: Response) => {
  res.status(410).json({ success: false, error: { code: 'GONE', message: 'Artist editing is no longer supported' } });
};

