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

    // Check if this name is an alias → resolve to canonical name
    let resolvedName = name;
    let aliasNames: string[] = [];
    try {
      const aliasCheck = await pool.query(
        'SELECT canonical_name FROM artist_aliases WHERE LOWER(alias_name) = LOWER($1) LIMIT 1',
        [name]
      );
      if (aliasCheck.rows.length > 0) resolvedName = aliasCheck.rows[0].canonical_name;

      const aliasResult = await pool.query(
        'SELECT alias_name FROM artist_aliases WHERE LOWER(canonical_name) = LOWER($1)',
        [resolvedName]
      );
      aliasNames = aliasResult.rows.map((r: any) => r.alias_name);
    } catch {
      // artist_aliases table may not exist yet — degrade gracefully
    }

    const allNames = [resolvedName, ...aliasNames];

    // Build parameterized query for all names
    const nameParams = allNames.map((_, i) => `LOWER($${i + 1})`).join(', ');

    // Tracks featuring this person in credits (match all names)
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
      LEFT JOIN track_credits tc2 ON tc2.track_id = t.id AND LOWER(tc2.credit_value) IN (${nameParams})
      LEFT JOIN track_artists ta  ON t.id = ta.track_id
      LEFT JOIN artists ar        ON ta.artist_id = ar.id
      WHERE LOWER(tc.credit_value) IN (${nameParams})
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY t.created_at DESC
    `;
    const tracksResult = await pool.query(tracksQuery, allNames);
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
      WHERE LOWER(tc.credit_value) IN (${nameParams})
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `;
    const albumsResult = await pool.query(albumsQuery, allNames);

    // Games (via albums)
    const gamesQuery = `
      SELECT DISTINCT g.id, g.name, g.name_en, g.cover_path
      FROM track_credits tc
      JOIN tracks t ON tc.track_id = t.id
      JOIN albums a ON t.album_id = a.id
      JOIN games g ON a.game_id = g.id
      WHERE LOWER(tc.credit_value) IN (${nameParams})
      ORDER BY g.name
    `;
    const gamesResult = await pool.query(gamesQuery, allNames);

    // Summary stats + roles
    const statsQuery = `
      SELECT
        COUNT(DISTINCT tc.track_id)       AS track_count,
        COUNT(DISTINCT t.album_id)        AS album_count,
        array_agg(DISTINCT tc.credit_key) AS roles
      FROM track_credits tc
      LEFT JOIN tracks t ON tc.track_id = t.id
      WHERE LOWER(tc.credit_value) IN (${nameParams})
    `;
    const statsResult = await pool.query(statsQuery, allNames);
    const stats = statsResult.rows[0];

    if (parseInt(stats.track_count) === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artist not found' } });
    }

    res.json({
      success: true,
      data: {
        artist: {
          id: null,
          name: resolvedName,
          track_count: stats.track_count,
          album_count: stats.album_count,
          roles: stats.roles.filter(Boolean),
          aliases: aliasNames,
        },
        tracks,
        albums: albumsResult.rows,
        games: gamesResult.rows,
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

// Helper: ensure artist_aliases table exists
const ensureAliasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_aliases (
      id SERIAL PRIMARY KEY,
      canonical_name VARCHAR(500) NOT NULL,
      alias_name VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(canonical_name, alias_name)
    )
  `);
};

// Merge artists: create alias relationships
export const mergeArtists = async (req: Request, res: Response) => {
  try {
    await ensureAliasTable();
    const { canonicalName, aliasNames } = req.body;
    if (!canonicalName || !Array.isArray(aliasNames) || aliasNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供主名称和别名列表' }
      });
    }

    let created = 0;
    for (const alias of aliasNames) {
      const trimmed = alias.trim();
      if (!trimmed || trimmed.toLowerCase() === canonicalName.toLowerCase()) continue;
      try {
        await pool.query(
          `INSERT INTO artist_aliases (canonical_name, alias_name)
           VALUES ($1, $2)
           ON CONFLICT (canonical_name, alias_name) DO NOTHING`,
          [canonicalName.trim(), trimmed]
        );
        created++;
      } catch (e) {
        console.error('Insert alias error:', e);
      }
    }

    res.json({
      success: true,
      data: { created, message: `成功添加 ${created} 条别名` }
    });
  } catch (error) {
    console.error('Merge artists error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MERGE_ERROR', message: '合并艺术家失败' }
    });
  }
};

// Get all aliases
export const getAliases = async (req: Request, res: Response) => {
  try {
    await ensureAliasTable();
    const result = await pool.query(
      'SELECT * FROM artist_aliases ORDER BY canonical_name, alias_name'
    );
    res.json({
      success: true,
      data: { aliases: result.rows }
    });
  } catch (error) {
    console.error('Get aliases error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: '获取别名列表失败' }
    });
  }
};

// Delete alias
export const deleteAlias = async (req: Request, res: Response) => {
  try {
    await ensureAliasTable();
    const { id } = req.params;
    await pool.query('DELETE FROM artist_aliases WHERE id = $1', [id]);
    res.json({ success: true, data: { message: '别名已删除' } });
  } catch (error) {
    console.error('Delete alias error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: '删除别名失败' }
    });
  }
};

