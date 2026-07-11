import { Request, Response } from 'express';
import pool from '../config/database';
import storageService from '../services/storageService';
import { cache } from '../utils/cache';

interface ArtistRoleMapping {
  from: string;
  to: string;
}

interface UpdateArtistBody {
  name: string;
  roleMappings?: ArtistRoleMapping[];
}

// Get all artists (first-class entities in the `artists` table).
export const getArtists = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const includeAliases = String(req.query.include_aliases || '').toLowerCase() === 'true';

    // Per-artist aggregated stats, joined from track_credits.
    const statsCte = `
      stats AS (
        SELECT tc.artist_id,
               COUNT(DISTINCT tc.track_id)                 AS track_count,
               COUNT(DISTINCT t.album_id)                  AS album_count,
               array_agg(DISTINCT COALESCE(ara.canonical_role, tc.credit_key)) AS roles
        FROM track_credits tc
        LEFT JOIN tracks t ON tc.track_id = t.id
        LEFT JOIN artist_role_aliases ara ON LOWER(tc.credit_key) = LOWER(ara.alias_role)
        WHERE tc.artist_id IS NOT NULL
        GROUP BY tc.artist_id
      )`;

    // searchPattern: '%%' (empty search) matches everything.
    const sp = `%${search}%`;
    const searchCond = `(LOWER(a.name) LIKE LOWER($1)
                        OR a.name IN (SELECT canonical_name FROM artist_aliases WHERE LOWER(alias_name) LIKE LOWER($1)))`;

    // Admin view: include alias rows (annotated) alongside canonical artists.
    if (includeAliases) {
      const countSql = `WITH ${statsCte}
        SELECT COUNT(*)::int AS total FROM (
          SELECT a.name FROM artists a JOIN stats s ON s.artist_id = a.id
          WHERE ${searchCond}
          UNION ALL
          SELECT aa.alias_name FROM artist_aliases aa
          JOIN artists a ON LOWER(a.name) = LOWER(aa.canonical_name)
          JOIN stats s ON s.artist_id = a.id
          WHERE LOWER(aa.alias_name) LIKE LOWER($1)
        ) sub`;
      const countResult = await pool.query(countSql, [sp]);
      const total = parseInt(countResult.rows[0].total, 10);

      const listSql = `WITH ${statsCte}
        SELECT base.name, base.track_count, base.album_count, base.roles, base.is_alias, base.canonical_name
        FROM (
          SELECT a.name, s.track_count, s.album_count, s.roles, FALSE AS is_alias, NULL::text AS canonical_name
          FROM artists a JOIN stats s ON s.artist_id = a.id
          WHERE ${searchCond}
          UNION ALL
          SELECT aa.alias_name AS name, s.track_count, s.album_count, s.roles, TRUE AS is_alias, aa.canonical_name
          FROM artist_aliases aa
          JOIN artists a ON LOWER(a.name) = LOWER(aa.canonical_name)
          JOIN stats s ON s.artist_id = a.id
          WHERE LOWER(aa.alias_name) LIKE LOWER($1)
        ) base
        ORDER BY base.track_count DESC, base.is_alias ASC, base.name ASC
        LIMIT $2 OFFSET $3`;
      const listResult = await pool.query(listSql, [sp, limit, offset]);

      return res.json({
        success: true,
        data: {
          artists: listResult.rows,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    }

    // Public / default view: canonical artists only (fast, from artists table).
    const cacheKey = search ? null : `artists:p${page}:l${limit}`;
    if (cacheKey) {
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);
    }

    const whereSql = search ? `WHERE ${searchCond}` : 'WHERE TRUE';
    // Placeholders for LIMIT/OFFSET differ by branch:
    //   search  -> $1 = LIKE pattern, $2 = limit, $3 = offset
    //   no-search -> $1 = limit, $2 = offset
    const lp = search ? '$2' : '$1';
    const op = search ? '$3' : '$2';
    const countResult = await pool.query(
      `WITH ${statsCte} SELECT COUNT(*)::int AS total FROM artists a JOIN stats s ON s.artist_id = a.id ${whereSql}`,
      search ? [sp] : []
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const listResult = await pool.query(
      `WITH ${statsCte}
       SELECT a.id, a.name, a.slug, a.avatar_path, s.track_count, s.album_count, s.roles
       FROM artists a JOIN stats s ON s.artist_id = a.id
       ${whereSql}
       ORDER BY s.track_count DESC, a.name ASC
       LIMIT ${lp} OFFSET ${op}`,
      search ? [sp, limit, offset] : [limit, offset]
    );

    const response = {
      success: true,
      data: {
        artists: listResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
    if (cacheKey) cache.set(cacheKey, response, 180); // 3 min cache
    res.json(response);
  } catch (error: any) {
    console.error('Get artists error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch artists',
      },
    });
  }
};

// Get artist detail by numeric id OR name (canonical / alias).
export const getArtistById = async (req: Request, res: Response) => {
  try {
    const rawId = String(req.params.id || '').trim();

    // Resolve the artist entity: numeric id, else name (canonical or alias).
    let artistRow: any = null;
    const numericId = parseInt(rawId, 10);
    if (!isNaN(numericId)) {
      const r = await pool.query('SELECT * FROM artists WHERE id = $1', [numericId]);
      artistRow = r.rows[0];
    }
    if (!artistRow) {
      const r = await pool.query(
        `SELECT a.* FROM artists a
         WHERE LOWER(a.name) = LOWER($1)
         UNION
         SELECT a.* FROM artists a
         JOIN artist_aliases aa ON LOWER(aa.canonical_name) = LOWER(a.name)
         WHERE LOWER(aa.alias_name) = LOWER($1)
         LIMIT 1`,
        [rawId]
      );
      artistRow = r.rows[0];
    }
    if (!artistRow) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artist not found' } });
    }
    const artistId = artistRow.id;
    const artistName = artistRow.name;

    const cacheKey = `artist:${artistId}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return res.json(cached);

    const [tracksResult, albumsResult, gamesResult, statsResult, aliasResult, avatarResult] = await Promise.all([
      pool.query(
        `SELECT t.*,
                a.title       AS album_title,
                a.cover_path  AS album_cover,
                array_agg(DISTINCT COALESCE(ara.canonical_role, tc.credit_key)) AS roles,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', ar.id, 'name', ar.name))
                   FROM track_credits tcx
                   JOIN artists ar ON ar.id = tcx.artist_id
                   WHERE tcx.track_id = t.id AND tcx.artist_id IS DISTINCT FROM $1),
                  '[]'::json
                ) AS artists
         FROM track_credits tc
         JOIN tracks t ON tc.track_id = t.id
         LEFT JOIN albums a ON t.album_id = a.id
         LEFT JOIN artist_role_aliases ara ON LOWER(tc.credit_key) = LOWER(ara.alias_role)
         WHERE tc.artist_id = $1
         GROUP BY t.id, a.title, a.cover_path
         ORDER BY t.created_at DESC`,
        [artistId]
      ),
      pool.query(
        `SELECT DISTINCT a.*, COUNT(DISTINCT t2.id) AS track_count
         FROM track_credits tc
         JOIN tracks t ON tc.track_id = t.id
         JOIN albums a ON t.album_id = a.id
         LEFT JOIN tracks t2 ON a.id = t2.album_id
         WHERE tc.artist_id = $1
         GROUP BY a.id
         ORDER BY a.release_date DESC, a.title ASC`,
        [artistId]
      ),
      pool.query(
        `SELECT DISTINCT g.id, g.name, g.name_en, g.cover_path
         FROM track_credits tc
         JOIN tracks t ON tc.track_id = t.id
         JOIN albums a ON t.album_id = a.id
         JOIN games g ON a.game_id = g.id
         WHERE tc.artist_id = $1
         ORDER BY g.name`,
        [artistId]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT tc.track_id) AS track_count,
                COUNT(DISTINCT t.album_id)  AS album_count,
                array_agg(DISTINCT COALESCE(ara.canonical_role, tc.credit_key)) AS roles
         FROM track_credits tc
         LEFT JOIN tracks t ON tc.track_id = t.id
         LEFT JOIN artist_role_aliases ara ON LOWER(tc.credit_key) = LOWER(ara.alias_role)
         WHERE tc.artist_id = $1`,
        [artistId]
      ),
      pool.query(
        `SELECT alias_name FROM artist_aliases WHERE LOWER(canonical_name) = LOWER($1)`,
        [artistName]
      ),
      pool.query(
        `SELECT avatar_path FROM artist_avatars WHERE LOWER(artist_name) = LOWER($1) LIMIT 1`,
        [artistName]
      ),
    ]);

    const stats = statsResult.rows[0];
    if (!stats || parseInt(stats.track_count) === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artist not found' } });
    }

    const aliasNames = aliasResult.rows.map((r: any) => r.alias_name);
    const avatarPath = avatarResult.rows[0]?.avatar_path ?? null;

    const response = {
      success: true,
      data: {
        artist: {
          id: artistId,
          name: artistName,
          track_count: stats.track_count,
          album_count: stats.album_count,
          roles: (stats.roles || []).filter(Boolean),
          aliases: aliasNames,
          avatar_path: avatarPath,
        },
        tracks: tracksResult.rows,
        albums: albumsResult.rows,
        games: gamesResult.rows,
      },
    };
    cache.set(cacheKey, response, 120); // 2 min cache
    res.json(response);
  } catch (error) {
    console.error('Get artist by ID error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch artist details' } });
  }
};

// Update artist name/roles and apply changes to original track credits
export const updateArtist = async (req: Request, res: Response) => {
  const sourceName = decodeURIComponent(String(req.params.id || '')).trim();
  const { name, roleMappings = [] } = req.body as UpdateArtistBody;
  const targetName = String(name || '').trim();

  if (!sourceName || !targetName) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '缺少原名称或新名称' }
    });
  }

  const normalizedRoleMappings = roleMappings
    .map((m) => ({
      from: String(m.from || '').trim(),
      to: String(m.to || '').trim(),
    }))
    .filter((m) => m.from.length > 0 && m.to.length > 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updatedRoleRows = 0;
    for (const mapping of normalizedRoleMappings) {
      const roleUpdate = await client.query(
        `UPDATE track_credits
         SET credit_key = $1, updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(credit_value) = LOWER($2)
           AND LOWER(credit_key) = LOWER($3)`,
        [mapping.to, sourceName, mapping.from]
      );
      updatedRoleRows += roleUpdate.rowCount ?? 0;
    }

    const nameUpdate = await client.query(
      `UPDATE track_credits
       SET credit_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(credit_value) = LOWER($2)`,
      [targetName, sourceName]
    );

    // Keep avatar mapping aligned with renamed artist name when table exists.
    try {
      await client.query(
        'UPDATE artist_avatars SET artist_name = $1 WHERE LOWER(artist_name) = LOWER($2)',
        [targetName, sourceName]
      );
    } catch {
      // Ignore if artist_avatars table does not exist yet.
    }

    await client.query('COMMIT');

    cache.invalidatePattern('artist');
    cache.invalidatePattern('artists');

    return res.json({
      success: true,
      data: {
        source_name: sourceName,
        target_name: targetName,
        updated_name_rows: nameUpdate.rowCount,
        updated_role_rows: updatedRoleRows,
        role_mapping_count: normalizedRoleMappings.length,
        message: '艺术家名称/职务已更新，并已应用到原歌曲 Credits'
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Update artist error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: '更新艺术家失败' }
    });
  } finally {
    client.release();
  }
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

const ensureRoleAliasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_role_aliases (
      id SERIAL PRIMARY KEY,
      canonical_role VARCHAR(200) NOT NULL,
      alias_role VARCHAR(200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(canonical_role, alias_role)
    )
  `);
};

export const getArtistRoles = async (req: Request, res: Response) => {
  try {
    await ensureRoleAliasTable();
    const search = String(req.query.search || '').trim();
    const params: any[] = [];
    let whereSql = '';
    if (search) {
      params.push(`%${search}%`);
      whereSql = 'WHERE LOWER(role_name) LIKE LOWER($1)';
    }

    const result = await pool.query(
      `WITH canonical_roles AS (
         SELECT COALESCE(ara.canonical_role, tc.credit_key) AS role_name
         FROM track_credits tc
         LEFT JOIN artist_role_aliases ara ON LOWER(tc.credit_key) = LOWER(ara.alias_role)
         WHERE tc.credit_key IS NOT NULL AND BTRIM(tc.credit_key) <> ''
       )
       SELECT role_name AS role, COUNT(*)::int AS usage_count
       FROM canonical_roles
       ${whereSql}
       GROUP BY role_name
       ORDER BY usage_count DESC, role_name ASC`,
      params
    );

    return res.json({
      success: true,
      data: { roles: result.rows },
    });
  } catch (error) {
    console.error('Get artist roles error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: '获取角色列表失败' },
    });
  }
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

    cache.invalidatePattern('artist');
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

export const mergeArtistRoles = async (req: Request, res: Response) => {
  try {
    await ensureRoleAliasTable();
    const { canonicalRole, aliasRoles } = req.body as { canonicalRole: string; aliasRoles: string[] };
    if (!canonicalRole || !Array.isArray(aliasRoles) || aliasRoles.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供主角色和别名角色列表' },
      });
    }

    let created = 0;
    const canonical = canonicalRole.trim();
    for (const role of aliasRoles) {
      const alias = String(role || '').trim();
      if (!alias || alias.toLowerCase() === canonical.toLowerCase()) continue;
      await pool.query(
        `INSERT INTO artist_role_aliases (canonical_role, alias_role)
         VALUES ($1, $2)
         ON CONFLICT (canonical_role, alias_role) DO NOTHING`,
        [canonical, alias]
      );
      created += 1;
    }

    cache.invalidatePattern('artist');
    cache.invalidatePattern('artists');
    return res.json({
      success: true,
      data: { created, message: `成功添加 ${created} 条角色别名` },
    });
  } catch (error) {
    console.error('Merge artist roles error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'MERGE_ERROR', message: '合并角色别名失败' },
    });
  }
};

export const getRoleAliases = async (req: Request, res: Response) => {
  try {
    await ensureRoleAliasTable();
    const result = await pool.query('SELECT * FROM artist_role_aliases ORDER BY canonical_role, alias_role');
    return res.json({ success: true, data: { aliases: result.rows } });
  } catch (error) {
    console.error('Get role aliases error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: '获取角色别名失败' },
    });
  }
};

export const deleteRoleAlias = async (req: Request, res: Response) => {
  try {
    await ensureRoleAliasTable();
    const { id } = req.params;
    await pool.query('DELETE FROM artist_role_aliases WHERE id = $1', [id]);
    cache.invalidatePattern('artist');
    cache.invalidatePattern('artists');
    return res.json({ success: true, data: { message: '角色别名已删除' } });
  } catch (error) {
    console.error('Delete role alias error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: '删除角色别名失败' },
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

// ============ Artist Avatars ============

// Helper: ensure artist_avatars table exists
const ensureAvatarTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_avatars (
      id SERIAL PRIMARY KEY,
      artist_name VARCHAR(500) NOT NULL UNIQUE,
      avatar_path VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// Upload artist avatar
export const uploadArtistAvatar = async (req: Request, res: Response) => {
  try {
    await ensureAvatarTable();
    const artistName = decodeURIComponent(req.params.name as string);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No avatar file uploaded' }
      });
    }

    // Upload to storage
    const avatarUrl = await storageService.uploadFile(
      req.file.buffer,
      `avatar_${artistName}_${Date.now()}.${req.file.originalname.split('.').pop()}`,
      'covers',
      req.file.mimetype
    );

    // Upsert into artist_avatars
    await pool.query(
      `INSERT INTO artist_avatars (artist_name, avatar_path)
       VALUES ($1, $2)
       ON CONFLICT (artist_name)
       DO UPDATE SET avatar_path = $2, updated_at = CURRENT_TIMESTAMP`,
      [artistName, avatarUrl]
    );

    res.json({
      success: true,
      data: { artist_name: artistName, avatar_path: avatarUrl }
    });
  } catch (error) {
    console.error('Upload artist avatar error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to upload artist avatar' }
    });
  }
};

// Get artist avatar
export const getArtistAvatar = async (req: Request, res: Response) => {
  try {
    await ensureAvatarTable();
    const artistName = decodeURIComponent(req.params.name as string);
    const result = await pool.query(
      'SELECT avatar_path FROM artist_avatars WHERE artist_name = $1',
      [artistName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No avatar found for this artist' }
      });
    }

    res.json({
      success: true,
      data: { avatar_path: result.rows[0].avatar_path }
    });
  } catch (error) {
    console.error('Get artist avatar error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to get artist avatar' }
    });
  }
};

// Get all artist avatars (batch)
export const getAllArtistAvatars = async (req: Request, res: Response) => {
  try {
    await ensureAvatarTable();
    const result = await pool.query('SELECT artist_name, avatar_path FROM artist_avatars ORDER BY artist_name');
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.artist_name] = row.avatar_path;
    }
    res.json({ success: true, data: { avatars: map } });
  } catch (error) {
    console.error('Get all artist avatars error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to get artist avatars' }
    });
  }
};

