import { Request, Response } from 'express';
import { parseBuffer } from 'music-metadata';
import path from 'path';
import pool from '../config/database';
import { TrackWithDetails } from '../types';
import webdavService from '../services/webdavService';

export const uploadTracks = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No files uploaded' }
      });
    }

    const uploadedTracks = [];

    for (const file of files) {
      try {
        // Extract metadata from FLAC file (从Buffer中读取)
        const metadata = await parseBuffer(file.buffer, file.mimetype);

        const title = metadata.common.title || path.basename(file.originalname, '.flac');
        const artistNames = metadata.common.artists || (metadata.common.artist ? [metadata.common.artist] : ['Unknown Artist']);
        const albumTitle = metadata.common.album || null;
        const trackNumber = metadata.common.track.no || null;
        const releaseDate = metadata.common.year ? new Date(metadata.common.year, 0, 1) : null;
        const duration = metadata.format.duration ? Math.floor(metadata.format.duration) : null;
        const sampleRate = metadata.format.sampleRate || null;
        const bitsPerSample = metadata.format.bitsPerSample || null;
        const fileSize = file.size;

        // Upload FLAC file to WebDAV
        const trackRemotePath = webdavService.generateRemotePath(file.originalname, 'tracks');
        const trackUrl = await webdavService.uploadFile(
          file.buffer,
          trackRemotePath,
          file.mimetype
        );

        // Extract and upload cover art to WebDAV
        let coverUrl = null;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const coverExt = picture.format.split('/')[1] || 'jpg';
          const coverFileName = `${path.basename(file.originalname, '.flac')}.${coverExt}`;
          const coverRemotePath = webdavService.generateRemotePath(coverFileName, 'covers');

          coverUrl = await webdavService.uploadFile(
            Buffer.from(picture.data),  // Convert Uint8Array to Buffer
            coverRemotePath,
            picture.format
          );
        }

        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          // Handle album
          let albumId = null;
          if (albumTitle) {
            const albumResult = await client.query(
              'SELECT id FROM albums WHERE title = $1',
              [albumTitle]
            );

            if (albumResult.rows.length > 0) {
              albumId = albumResult.rows[0].id;

              // Update album cover if not set
              if (coverUrl) {
                await client.query(
                  'UPDATE albums SET cover_path = $1 WHERE id = $2 AND cover_path IS NULL',
                  [coverUrl, albumId]
                );
              }
            } else {
              const newAlbum = await client.query(
                'INSERT INTO albums (title, cover_path, release_date) VALUES ($1, $2, $3) RETURNING id',
                [albumTitle, coverUrl, releaseDate]
              );
              albumId = newAlbum.rows[0].id;
            }
          }

          // Insert track (存储WebDAV URL)
          const trackResult = await client.query(
            `INSERT INTO tracks 
            (title, album_id, file_path, cover_path, duration, track_number, sample_rate, bit_depth, file_size, release_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
              title,
              albumId,
              trackUrl,  // WebDAV URL
              coverUrl,  // WebDAV URL
              duration,
              trackNumber,
              sampleRate,
              bitsPerSample,
              fileSize,
              releaseDate,
            ]
          );

          const track = trackResult.rows[0];

          // Handle artists
          for (const artistName of artistNames) {
            let artistResult = await client.query(
              'SELECT id FROM artists WHERE name = $1',
              [artistName]
            );

            let artistId;
            if (artistResult.rows.length > 0) {
              artistId = artistResult.rows[0].id;
            } else {
              const newArtist = await client.query(
                'INSERT INTO artists (name) VALUES ($1) RETURNING id',
                [artistName]
              );
              artistId = newArtist.rows[0].id;
            }

            await client.query(
              'INSERT INTO track_artists (track_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [track.id, artistId]
            );
          }

          await client.query('COMMIT');

          uploadedTracks.push({
            id: track.id,
            title: track.title,
            artists: artistNames,
            album: albumTitle,
          });
        } catch (error) {
          await client.query('ROLLBACK');
          // 删除已上传的WebDAV文件
          await webdavService.deleteFile(trackRemotePath);
          if (coverUrl) {
            const coverRelativePath = webdavService.extractRelativePath(coverUrl);
            await webdavService.deleteFile(coverRelativePath);
          }
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    res.json({
      success: true,
      data: {
        tracks: uploadedTracks,
        total: uploadedTracks.length,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to upload tracks' }
    });
  }
};

export const getTracks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    // Build search condition
    let searchCondition = '';
    const queryParams: any[] = [limit, offset];

    if (search) {
      searchCondition = `
        WHERE (
          LOWER(t.title) LIKE LOWER($3)
          OR LOWER(a.title) LIKE LOWER($3)
          OR EXISTS (
            SELECT 1 FROM track_artists ta2
            JOIN artists ar2 ON ta2.artist_id = ar2.id
            WHERE ta2.track_id = t.id
            AND LOWER(ar2.name) LIKE LOWER($3)
          )
        )
      `;
      queryParams.push(`%${search}%`);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT t.id) 
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      ${searchCondition}
    `;

    const countResult = await pool.query(countQuery, search ? [queryParams[2]] : []);
    const total = parseInt(countResult.rows[0].count);

    const tracksQuery = `
      SELECT 
        t.*,
        a.title as album_title,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      ${searchCondition}
      GROUP BY t.id, a.title
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const tracksResult = await pool.query(tracksQuery, queryParams);

    const tracks: TrackWithDetails[] = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    res.json({
      success: true,
      data: {
        tracks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch tracks' }
    });
  }
};

export const getTrackById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query(
      `SELECT 
        t.*,
        a.title as album_title,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.id = $1
      GROUP BY t.id, a.title`,
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const track: TrackWithDetails = {
      ...trackResult.rows[0],
      artists: trackResult.rows[0].artists.filter((a: any) => a.id !== null),
    };

    res.json({
      success: true,
      data: { track },
    });
  } catch (error) {
    console.error('Get track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch track' }
    });
  }
};

export const streamTrack = async (req: Request, res: Response) => {
export const streamTrack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query('SELECT file_path FROM tracks WHERE id = $1', [id]);

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const filePath = trackResult.rows[0].file_path;

    // filePath现在是WebDAV URL，直接重定向到WebDAV服务器
    // 或者如果需要认证，可以在这里做代理

    // 方案1: 直接重定向（如果WebDAV公开访问）
    return res.redirect(filePath);

    // 方案2: 如果需要代理（保护WebDAV认证信息）
    // const axios = require('axios');
    // const response = await axios.get(filePath, {
    //   responseType: 'stream',
    //   headers: req.headers.range ? { Range: req.headers.range } : {},
    //   auth: {
    //     username: webdavConfig.username,
    //     password: webdavConfig.password
    //   }
    // });
    //
    // res.set(response.headers);
    // response.data.pipe(res);
  } catch (error) {
    console.error('Stream track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'STREAM_ERROR', message: 'Failed to stream track' }
    });
  }
};

export const downloadTrack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query('SELECT title, file_path FROM tracks WHERE id = $1', [id]);

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { title, file_path } = trackResult.rows[0];
    const filePath = path.join(process.cwd(), 'uploads', file_path);

    res.download(filePath, `${title}.flac`, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download track' }
          });
        }
      }
    });
  } catch (error) {
    console.error('Download track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download track' }
    });
  }
};

// Update track metadata
export const updateTrack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, artists, album_title } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update track title
      await client.query(
        'UPDATE tracks SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [title, id]
      );

      // Handle album
      let albumId = null;
      if (album_title) {
        const albumResult = await client.query(
          'SELECT id FROM albums WHERE title = $1',
          [album_title]
        );

        if (albumResult.rows.length > 0) {
          albumId = albumResult.rows[0].id;
        } else {
          const newAlbum = await client.query(
            'INSERT INTO albums (title) VALUES ($1) RETURNING id',
            [album_title]
          );
          albumId = newAlbum.rows[0].id;
        }

        await client.query(
          'UPDATE tracks SET album_id = $1 WHERE id = $2',
          [albumId, id]
        );
      }

      // Handle artists - remove old relationships
      await client.query('DELETE FROM track_artists WHERE track_id = $1', [id]);

      // Add new artists
      if (artists && Array.isArray(artists)) {
        for (const artistName of artists) {
          let artistResult = await client.query(
            'SELECT id FROM artists WHERE name = $1',
            [artistName.trim()]
          );

          let artistId;
          if (artistResult.rows.length > 0) {
            artistId = artistResult.rows[0].id;
          } else {
            const newArtist = await client.query(
              'INSERT INTO artists (name) VALUES ($1) RETURNING id',
              [artistName.trim()]
            );
            artistId = newArtist.rows[0].id;
          }

          await client.query(
            'INSERT INTO track_artists (track_id, artist_id) VALUES ($1, $2)',
            [id, artistId]
          );
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: { message: 'Track updated successfully' }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update track' }
    });
  }
};

// Delete track
export const deleteTrack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get track file paths before deletion
    const trackResult = await pool.query(
      'SELECT file_path, cover_path FROM tracks WHERE id = $1',
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { file_path, cover_path } = trackResult.rows[0];

    // Delete from database (cascade will handle track_artists)
    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);

    // Delete files from WebDAV
    try {
      if (file_path) {
        const relativePath = webdavService.extractRelativePath(file_path);
        await webdavService.deleteFile(relativePath);
      }
      if (cover_path) {
        const relativePath = webdavService.extractRelativePath(cover_path);
        await webdavService.deleteFile(relativePath);
      }
    } catch (fileError) {
      console.error('Error deleting files from WebDAV:', fileError);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      data: { message: 'Track deleted successfully' }
    });
  } catch (error) {
    console.error('Delete track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete track' }
    });
  }
};

// Upload cover for track
export const uploadTrackCover = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No cover file uploaded' }
      });
    }

    // Upload to WebDAV
    const coverRemotePath = webdavService.generateRemotePath(req.file.originalname, 'covers');
    const coverUrl = await webdavService.uploadFile(
      req.file.buffer,
      coverRemotePath,
      req.file.mimetype
    );

    // Update track cover
    const result = await pool.query(
      'UPDATE tracks SET cover_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [coverUrl, id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if track not found
      await webdavService.deleteFile(coverRemotePath);

      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    res.json({
      success: true,
      data: {
        track: result.rows[0],
        cover_path: coverUrl
      },
    });
  } catch (error) {
    console.error('Upload track cover error:', error);


    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to upload cover' }
    });
  }
};

