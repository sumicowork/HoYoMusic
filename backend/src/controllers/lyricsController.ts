import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const LYRICS_DIR = path.join(process.cwd(), 'uploads', 'lyrics');

// Ensure lyrics directory exists
fs.mkdir(LYRICS_DIR, { recursive: true }).catch(console.error);

// Upload lyrics file
export const uploadLyrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lyricsContent = req.body.lyrics;

    if (!lyricsContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_LYRICS', message: 'No lyrics content provided' }
      });
    }

    // Generate unique filename
    const filename = `${uuidv4()}.lrc`;
    const filePath = path.join(LYRICS_DIR, filename);
    const relativePath = `/lyrics/${filename}`;

    // Save lyrics file
    await fs.writeFile(filePath, lyricsContent, 'utf-8');

    // Update track record
    await pool.query(
      'UPDATE tracks SET lyrics_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [relativePath, id]
    );

    res.json({
      success: true,
      data: {
        lyrics_path: relativePath,
        message: 'Lyrics uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Upload lyrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to upload lyrics' }
    });
  }
};

// Get lyrics content
export const getLyrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query(
      'SELECT lyrics_path FROM tracks WHERE id = $1',
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { lyrics_path } = trackResult.rows[0];

    if (!lyrics_path) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_LYRICS', message: 'No lyrics available for this track' }
      });
    }

    const filePath = path.join(process.cwd(), 'uploads', lyrics_path);
    const lyricsContent = await fs.readFile(filePath, 'utf-8');

    res.json({
      success: true,
      data: {
        lyrics: lyricsContent,
        lyrics_path
      }
    });
  } catch (error) {
    console.error('Get lyrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch lyrics' }
    });
  }
};

// Update lyrics content
export const updateLyrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lyricsContent = req.body.lyrics;

    if (!lyricsContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_LYRICS', message: 'No lyrics content provided' }
      });
    }

    const trackResult = await pool.query(
      'SELECT lyrics_path FROM tracks WHERE id = $1',
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { lyrics_path } = trackResult.rows[0];

    if (!lyrics_path) {
      // No existing lyrics, create new file
      return uploadLyrics(req, res);
    }

    // Update existing file
    const filePath = path.join(process.cwd(), 'uploads', lyrics_path);
    await fs.writeFile(filePath, lyricsContent, 'utf-8');

    await pool.query(
      'UPDATE tracks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      data: {
        lyrics_path,
        message: 'Lyrics updated successfully'
      }
    });
  } catch (error) {
    console.error('Update lyrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update lyrics' }
    });
  }
};

// Delete lyrics
export const deleteLyrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query(
      'SELECT lyrics_path FROM tracks WHERE id = $1',
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { lyrics_path } = trackResult.rows[0];

    if (lyrics_path) {
      // Delete file
      try {
        const filePath = path.join(process.cwd(), 'uploads', lyrics_path);
        await fs.unlink(filePath);
      } catch (fileError) {
        console.error('Error deleting lyrics file:', fileError);
      }
    }

    // Update database
    await pool.query(
      'UPDATE tracks SET lyrics_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      data: { message: 'Lyrics deleted successfully' }
    });
  } catch (error) {
    console.error('Delete lyrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete lyrics' }
    });
  }
};

