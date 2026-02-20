import { Request, Response } from 'express';
import { parseBuffer } from 'music-metadata';
import path from 'path';
import pool from '../config/database';
import { TrackWithDetails } from '../types';
import storageService from '../services/storageService';

// Fields already stored in dedicated columns – skip from credits
const CREDIT_SKIP_KEYS = new Set([
  'title', 'titlesort', 'titlesortorder',
  'artist', 'artists', 'artistsort', 'artistsortorder',
  'albumartist', 'albumartistsort', 'albumartistsortorder',
  'album', 'albumsort', 'albumsortorder',
  'track', 'tracknumber', 'trackno', 'trck',
  'disk', 'discnumber', 'tpos',
  'date', 'year', 'originaldate', 'originalyear', 'tdrc', 'tyer', 'tdor',
  'picture', 'apic', 'covr', 'metadata_block_picture',
  // replaygain – technical, not credits
  'replaygain_track_gain', 'replaygain_track_peak',
  'replaygain_album_gain', 'replaygain_album_peak',
  'replaygain_reference_loudness',
  'replaygain_track_gain_ratio', 'replaygain_track_peak_ratio',
  'replaygain_album_gain_ratio', 'replaygain_album_peak_ratio',
  'replaygain_track_minmax', 'replaygain_album_minmax', 'replaygain_undo',
  'waveformatextensible_channel_mask',
  'encoder', 'encoding', 'encodingsettings', 'encodedby', 'encodersettings',
  // MusicBrainz / acoustid IDs
  'musicbrainz_trackid', 'musicbrainz_albumid', 'musicbrainz_artistid',
  'musicbrainz_albumartistid', 'musicbrainz_releasegroupid',
  'musicbrainz_workid', 'musicbrainz_trmid', 'musicbrainz_discid',
  'musicbrainz_recordingid', 'musicip_puid', 'musicip_fingerprint',
  'acoustid_id', 'acoustid_fingerprint',
  // averageLevel / peakLevel – technical
  'averagelevel', 'peaklevel',
  // gapless / compilation – boolean flags
  'gapless', 'compilation',
  // stik / hdvideo – iTunes media type integers
  'stik', 'hdvideo',
  // playcounter
  'playcounter',
  // discogs IDs
  'discogs_artist_id', 'discogs_release_id', 'discogs_label_id',
  'discogs_master_release_id', 'discogs_votes', 'discogs_rating',
]);

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
        // music-metadata v11: second arg must be IFileInfo object or mime string
        const metadata = await parseBuffer(file.buffer, { mimeType: file.mimetype || 'audio/flac' });

        const title = metadata.common.title || path.basename(file.originalname, '.flac');
        const artistNames = metadata.common.artists || (metadata.common.artist ? [metadata.common.artist] : ['Unknown Artist']);
        const albumTitle = metadata.common.album || null;
        const trackNumber = metadata.common.track.no || null;
        const releaseDate = metadata.common.year ? new Date(metadata.common.year, 0, 1) : null;
        const duration = metadata.format.duration ? Math.floor(metadata.format.duration) : null;
        const sampleRate = metadata.format.sampleRate || null;
        const bitsPerSample = metadata.format.bitsPerSample || null;
        const fileSize = file.size;

        // Upload FLAC file to storage (local or WebDAV based on config)
        const trackUrl = await storageService.uploadFile(
          file.buffer,
          file.originalname,
          'tracks',
          file.mimetype
        );

        // Extract and upload cover art
        let coverUrl = null;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          // picture.format is like 'image/jpeg' or 'image/png'
          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg',
            'image/png': 'png', 'image/webp': 'webp',
            'image/gif': 'gif', 'image/bmp': 'bmp',
          };
          const coverExt = mimeToExt[picture.format.toLowerCase()] || picture.format.split('/')[1] || 'jpg';
          const baseName = path.basename(file.originalname, path.extname(file.originalname));
          const coverFileName = `${baseName}_cover.${coverExt}`;

          coverUrl = await storageService.uploadFile(
            Buffer.from(picture.data),
            coverFileName,
            'covers',
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

          // ── Auto-extract credits from ALL metadata tags ─────────────────
          // Use a "key|value" set to deduplicate across tag sources
          let creditOrder = 0;
          const insertedPairs = new Set<string>();

          const insertCredit = async (key: string, value: string) => {
            const normalized = value.trim();
            if (!normalized) return;
            const pair = `${key.toLowerCase()}|${normalized}`;
            if (insertedPairs.has(pair)) return;
            insertedPairs.add(pair);
            await client.query(
              `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order)
               VALUES ($1, $2, $3, $4)`,
              [track.id, key, normalized, creditOrder++]
            );
          };

          // Helper: convert any value to a list of strings
          const toStringList = (val: unknown): string[] => {
            if (val === null || val === undefined) return [];
            if (typeof val === 'string') return [val];
            if (typeof val === 'number' || typeof val === 'boolean') return [String(val)];
            if (val instanceof Uint8Array || Buffer.isBuffer(val)) return []; // binary – skip
            if (Array.isArray(val)) {
              return val.flatMap(item => toStringList(item));
            }
            // Object – try common text-carrying shapes
            if (typeof val === 'object') {
              const obj = val as Record<string, unknown>;
              // IComment / ILyricsTag  { text?: string, descriptor?: string }
              if (typeof obj['text'] === 'string' && obj['text']) return [obj['text']];
              // IRatio { dB: number, ratio: number }
              if (typeof obj['dB'] === 'number') return [`${obj['dB'].toFixed(2)} dB`];
              // { no, of } track/disk objects – skip
              if ('no' in obj && 'of' in obj) return [];
              return [];
            }
            return [];
          };

          // ── Step 1: Walk ALL native tag sources (vorbis, ID3v2, iTunes…) ──
          if (metadata.native) {
            for (const [, tags] of Object.entries(metadata.native)) {
              for (const tag of tags) {
                const keyLower = tag.id.toLowerCase();
                if (CREDIT_SKIP_KEYS.has(keyLower)) continue;
                const strings = toStringList(tag.value);
                for (const s of strings) {
                  await insertCredit(tag.id, s);
                }
              }
            }
          }

          // ── Step 2: Walk metadata.common for any fields not in native ────
          const commonObj = metadata.common as unknown as Record<string, unknown>;
          for (const [field, value] of Object.entries(commonObj)) {
            const fieldLower = field.toLowerCase();
            if (CREDIT_SKIP_KEYS.has(fieldLower)) continue;
            const strings = toStringList(value);
            for (const s of strings) {
              await insertCredit(field, s);
            }
          }
          // ─────────────────────────────────────────────────────────────────

          await client.query('COMMIT');

          uploadedTracks.push({
            id: track.id,
            title: track.title,
            artists: artistNames,
            album: albumTitle,
          });
        } catch (error) {
          await client.query('ROLLBACK');
          // 删除已上传的文件
          await storageService.deleteFile(trackUrl);
          if (coverUrl) {
            await storageService.deleteFile(coverUrl);
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
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    // --- 高级搜索参数 ---
    const sampleRateMin = req.query.sample_rate_min !== undefined && req.query.sample_rate_min !== ''
      ? parseInt(req.query.sample_rate_min as string) : null;
    const bitDepth = req.query.bit_depth !== undefined && req.query.bit_depth !== ''
      ? parseInt(req.query.bit_depth as string) : null;
    const yearFrom = req.query.year_from !== undefined && req.query.year_from !== ''
      ? parseInt(req.query.year_from as string) : null;
    const yearTo = req.query.year_to !== undefined && req.query.year_to !== ''
      ? parseInt(req.query.year_to as string) : null;
    const durationMin = req.query.duration_min !== undefined && req.query.duration_min !== ''
      ? parseInt(req.query.duration_min as string) : null;
    const durationMax = req.query.duration_max !== undefined && req.query.duration_max !== ''
      ? parseInt(req.query.duration_max as string) : null;
    // tag_ids: 逗号分隔的 tag id 列表，支持多选
    const tagIdsRaw = req.query.tag_ids as string || '';
    const tagIds = tagIdsRaw
      ? tagIdsRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [];
    const tagLogic = (req.query.tag_logic as string)?.toUpperCase() === 'OR' ? 'OR' : 'AND';

    const sortBy  = (req.query.sort_by as string) || 'created_at';
    const sortDir = (req.query.sort_dir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const allowedSort: Record<string, string> = {
      created_at:   't.created_at',
      title:        't.title',
      duration:     't.duration',
      sample_rate:  't.sample_rate',
      release_date: 't.release_date',
    };
    const orderBy = allowedSort[sortBy] || 't.created_at';

    // Build WHERE clauses
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(
        LOWER(t.title) LIKE LOWER($${pIdx})
        OR LOWER(a.title) LIKE LOWER($${pIdx})
        OR EXISTS (
          SELECT 1 FROM track_artists ta2
          JOIN artists ar2 ON ta2.artist_id = ar2.id
          WHERE ta2.track_id = t.id
          AND LOWER(ar2.name) LIKE LOWER($${pIdx})
        )
      )`);
      queryParams.push(`%${search}%`);
      pIdx++;
    }
    if (sampleRateMin !== null) {
      conditions.push(`t.sample_rate >= $${pIdx++}`);
      queryParams.push(sampleRateMin);
    }
    if (bitDepth !== null) {
      conditions.push(`t.bit_depth = $${pIdx++}`);
      queryParams.push(bitDepth);
    }
    if (yearFrom !== null) {
      conditions.push(`EXTRACT(YEAR FROM COALESCE(t.release_date, t.created_at)) >= $${pIdx++}`);
      queryParams.push(yearFrom);
    }
    if (yearTo !== null) {
      conditions.push(`EXTRACT(YEAR FROM COALESCE(t.release_date, t.created_at)) <= $${pIdx++}`);
      queryParams.push(yearTo);
    }
    if (durationMin !== null) {
      conditions.push(`t.duration >= $${pIdx++}`);
      queryParams.push(durationMin);
    }
    if (durationMax !== null) {
      conditions.push(`t.duration <= $${pIdx++}`);
      queryParams.push(durationMax);
    }
    // Tag 筛选
    if (tagIds.length > 0) {
      const tagExistsClause = (tagId: number, paramIdx: number) => `EXISTS (
        SELECT 1 FROM track_tags ttg
        JOIN tags tg ON ttg.tag_id = tg.id
        WHERE ttg.track_id = t.id
        AND (
          ttg.tag_id = $${paramIdx}
          OR tg.parent_id = $${paramIdx}
          OR EXISTS (
            SELECT 1 FROM tags child_tg
            WHERE child_tg.parent_id = $${paramIdx} AND child_tg.id = ttg.tag_id
          )
        )
      )`;

      if (tagLogic === 'OR') {
        // OR：任意一个 tag 匹配即可
        const orParts: string[] = [];
        for (const tagId of tagIds) {
          orParts.push(tagExistsClause(tagId, pIdx));
          queryParams.push(tagId);
          pIdx++;
        }
        conditions.push(`(${orParts.join(' OR ')})`);
      } else {
        // AND：每个 tag 都必须匹配（默认）
        for (const tagId of tagIds) {
          conditions.push(tagExistsClause(tagId, pIdx));
          queryParams.push(tagId);
          pIdx++;
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(DISTINCT t.id)
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    const limitParam  = pIdx++;
    const offsetParam = pIdx++;
    const tracksQuery = `
      SELECT
        t.*,
        a.title as album_title,
        a.cover_path as album_cover,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      ${whereClause}
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY ${orderBy} ${sortDir}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const tracksResult = await pool.query(tracksQuery, [...queryParams, limit, offset]);

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
        a.cover_path as album_cover,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.id = $1
      GROUP BY t.id, a.title, a.cover_path`,
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

    if (storageService.isWebDAV()) {
      // WebDAV模式：重定向到WebDAV URL
      return res.redirect(filePath);
    } else {
      // 本地存储模式：流式传输文件
      const fs = require('fs');
      const fullPath = storageService.getFullPath(filePath);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'File not found' }
        });
      }

      const stat = fs.statSync(fullPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // 支持Range请求（用于播放器seek功能）
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(fullPath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/flac',
        });

        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'audio/flac',
        });
        fs.createReadStream(fullPath).pipe(res);
      }
    }
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

    if (storageService.isWebDAV()) {
      // WebDAV模式：重定向到WebDAV URL
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.flac"`);
      return res.redirect(file_path);
    } else {
      // 本地存储模式：使用res.download
      const fullPath = storageService.getFullPath(file_path);
      res.download(fullPath, `${title}.flac`, (err) => {
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
    }
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

    // Delete files from storage
    try {
      if (file_path) {
        await storageService.deleteFile(file_path);
      }
      if (cover_path) {
        await storageService.deleteFile(cover_path);
      }
    } catch (fileError) {
      console.error('Error deleting files from storage:', fileError);
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

    // Upload to storage
    const coverUrl = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      'covers',
      req.file.mimetype
    );

    // Update track cover
    const result = await pool.query(
      'UPDATE tracks SET cover_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [coverUrl, id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if track not found
      await storageService.deleteFile(coverUrl);

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

