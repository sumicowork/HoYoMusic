import { Request, Response } from 'express';
import pool from '../config/database';

// 获取所有游戏
export const getGames = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT a.id) as album_count
      FROM games g
      LEFT JOIN albums a ON g.id = a.game_id
      GROUP BY g.id
      ORDER BY g.display_order ASC, g.name ASC
    `);

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
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch games' }
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
    const { name, name_en, description, display_order } = req.body;

    const result = await pool.query(
      `UPDATE games 
       SET name = $1, name_en = $2, description = $3, display_order = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
      [name, name_en, description, display_order, id]
    );

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

