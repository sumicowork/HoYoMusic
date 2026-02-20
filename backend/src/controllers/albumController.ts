import { Request, Response } from 'express';
import pool from '../config/database';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import storageService from '../services/storageService';

// Get all albums with track count
export const getAlbums = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';

    let searchCondition = '';
    const queryParams: any[] = [limit, offset];

    if (search) {
      searchCondition = 'WHERE LOWER(a.title) LIKE LOWER($3)';
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM albums a
      ${searchCondition}
    `;
    const countResult = await pool.query(countQuery, search ? [queryParams[2]] : []);
    const total = parseInt(countResult.rows[0].count);

    // Get albums with track count
    const albumsQuery = `
      SELECT 
        a.*,
        COUNT(DISTINCT t.id) as track_count,
        MIN(t.duration) as min_duration,
        SUM(t.duration) as total_duration
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      ${searchCondition}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const albumsResult = await pool.query(albumsQuery, queryParams);

    res.json({
      success: true,
      data: {
        albums: albumsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get albums error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch albums' }
    });
  }
};

// Get album by ID with all tracks
export const getAlbumById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get album info
    const albumQuery = `
      SELECT 
        a.*,
        COUNT(DISTINCT t.id) as track_count,
        SUM(t.duration) as total_duration
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      WHERE a.id = $1
      GROUP BY a.id
    `;
    const albumResult = await pool.query(albumQuery, [id]);

    if (albumResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    const album = albumResult.rows[0];

    // Get all tracks in this album
    const tracksQuery = `
      SELECT 
        t.*,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.album_id = $1
      GROUP BY t.id
      ORDER BY t.track_number ASC, t.title ASC
    `;
    const tracksResult = await pool.query(tracksQuery, [id]);

    const tracks = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    res.json({
      success: true,
      data: {
        album,
        tracks,
      },
    });
  } catch (error) {
    console.error('Get album by ID error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch album details' }
    });
  }
};

// Update album
export const updateAlbum = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, release_date, game_id } = req.body;

    const result = await pool.query(
      `UPDATE albums 
       SET title = $1, release_date = $2, game_id = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [title, release_date, game_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    res.json({
      success: true,
      data: { album: result.rows[0] },
    });
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update album' }
    });
  }
};

// Download album as ZIP
export const downloadAlbum = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get album info and tracks
    const albumQuery = `
      SELECT a.*, COUNT(t.id) as track_count
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      WHERE a.id = $1
      GROUP BY a.id
    `;
    const albumResult = await pool.query(albumQuery, [id]);

    if (albumResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    const album = albumResult.rows[0];

    // Get all tracks in this album
    const tracksQuery = `
      SELECT t.*, t.file_path
      FROM tracks t
      WHERE t.album_id = $1
      ORDER BY t.track_number ASC, t.title ASC
    `;
    const tracksResult = await pool.query(tracksQuery, [id]);

    if (tracksResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_TRACKS', message: 'No tracks found in this album' }
      });
    }

    // Set response headers
    const zipFileName = `${album.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

    // Create archiver
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'ARCHIVE_ERROR', message: 'Failed to create archive' }
      });
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add each track file to the archive
    for (const track of tracksResult.rows) {
      const filePath = storageService.isLocal()
        ? storageService.getFullPath(track.file_path)
        : track.file_path;

      // Check if file exists (only for local storage)
      if (storageService.isLocal() && fs.existsSync(filePath)) {
        const trackNumber = track.track_number ? String(track.track_number).padStart(2, '0') : '00';
        const fileName = `${trackNumber} - ${track.title}.flac`;
        archive.file(filePath, { name: fileName });
      } else if (storageService.isWebDAV()) {
        console.warn('WebDAV batch download not implemented yet');
        // TODO: 实现WebDAV批量下载
      } else {
        console.warn(`File not found: ${filePath}`);
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Download album error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download album' }
      });
    }
  }
};

// Upload cover for album
export const uploadCover = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No cover file uploaded' }
      });
    }

    // Upload to storage
    const coverUrl = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      'covers',
      req.file.mimetype
    );

    // Update album cover
    const result = await pool.query(
      'UPDATE albums SET cover_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [coverUrl, id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if album not found
      await storageService.deleteFile(coverUrl);

      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    res.json({
      success: true,
      data: {
        album: result.rows[0],
        cover_path: coverUrl
      },
    });
  } catch (error) {
    console.error('Upload cover error:', error);


    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to upload cover' }
    });
  }
};

