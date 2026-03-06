import { Request, Response } from 'express';
import pool from '../config/database';
import { cache } from '../utils/cache';

// 获取所有游戏
export const getGames = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'games:all';
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      return res.json({ success: true, data: { games: cached } });
    }

    const result = await pool.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT a.id) as album_count
      FROM games g
      LEFT JOIN albums a ON g.id = a.game_id
      GROUP BY g.id
      ORDER BY g.display_order ASC, g.name ASC
    `);

    cache.set(cacheKey, result.rows, 300); // 缓存 5 分钟

    res.json({
      success: true,
      data: {
        games: result.rows
      }
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: '获取游戏列表失败' }
    });
  }
};

// 获取游戏详情（包含专辑列表）
export const getGameById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 获取游戏信息
    const gameResult = await pool.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT a.id) as album_count
      FROM games g
      LEFT JOIN albums a ON g.id = a.game_id
      WHERE g.id = $1
      GROUP BY g.id
    `, [id]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' }
      });
    }

    const game = gameResult.rows[0];

    // 获取该游戏的所有专辑
    const albumsResult = await pool.query(`
      SELECT 
        a.*,
        COUNT(DISTINCT t.id) as track_count,
        SUM(t.duration) as total_duration
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      WHERE a.game_id = $1
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        game,
        albums: albumsResult.rows
      }
    });
  } catch (error) {
    console.error('Get game by ID error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch game details' }
    });
  }
};

// 更新游戏信息
export const updateGame = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, name_en, description, display_order, status, cover_path } = req.body;

    const result = await pool.query(
      `UPDATE games 
       SET name = COALESCE($1, name), name_en = COALESCE($2, name_en), 
           description = COALESCE($3, description), display_order = COALESCE($4, display_order),
           status = COALESCE($5, status), cover_path = COALESCE($6, cover_path),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 
       RETURNING *`,
      [name ?? null, name_en ?? null, description ?? null, display_order ?? null, status ?? null, cover_path ?? null, id]
    );
    cache.invalidate('games:all');

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' }
      });
    }

    res.json({
      success: true,
      data: { game: result.rows[0] }
    });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update game' }
    });
  }
};

// 创建游戏
export const createGame = async (req: Request, res: Response) => {
  try {
    const { name, name_en, description, display_order, status, cover_path } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '游戏名称不能为空' }
      });
    }

    const result = await pool.query(
      `INSERT INTO games (name, name_en, description, display_order, status, cover_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), name_en || null, description || null, display_order || 0, status || 'active', cover_path || null]
    );
    cache.invalidate('games:all');

    res.status(201).json({
      success: true,
      data: { game: result.rows[0] }
    });
  } catch (error: any) {
    console.error('Create game error:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: '游戏名称已存在' }
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create game' }
    });
  }
};

// 上传游戏封面
export const uploadGameCover = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No cover file uploaded' }
      });
    }

    const storageService = (await import('../services/storageService')).default;
    const coverUrl = await storageService.uploadFile(
      req.file.buffer,
      `game_cover_${id}_${Date.now()}.${req.file.originalname.split('.').pop()}`,
      'covers',
      req.file.mimetype
    );

    const result = await pool.query(
      `UPDATE games SET cover_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [coverUrl, id]
    );
    cache.invalidate('games:all');

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Game not found' } });
    }

    res.json({ success: true, data: { game: result.rows[0] } });
  } catch (error) {
    console.error('Upload game cover error:', error);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: 'Failed to upload game cover' } });
  }
};

