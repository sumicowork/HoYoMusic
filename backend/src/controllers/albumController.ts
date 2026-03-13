import { Request, Response } from 'express';
import pool from '../config/database';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { parseBuffer } from 'music-metadata';
import storageService from '../services/storageService';
import { generateThumbnails, deriveThumbnailPath } from '../utils/thumbnails';
import { cache } from '../utils/cache';

const BPM_GROUP_NAME = 'BPM';
const BPM_TAG_COLOR = '#13c2c2';
const BPM_MIN = 40;
const BPM_MAX = 300;
const REMOTE_READ_BYTES = 1024 * 512;
const BPM_ANALYZER_SCRIPT = path.join(process.cwd(), 'scripts', 'detect_bpm.py');
const BPM_ANALYZER_TIMEOUT_MS = 180000;
const BPM_LOW_CONFIDENCE_THRESHOLD = 0.55;

type BpmDetection = {
  bpm: number;
  confidence: number | null;
  method: 'essentia' | 'librosa' | 'metadata';
};

const fetchBufferFromUrl = async (url: string, maxBytes: number): Promise<Buffer> => {
  return await new Promise<Buffer>((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(
      url,
      { headers: { Range: `bytes=0-${maxBytes - 1}` } },
      (resp) => {
        const chunks: Buffer[] = [];
        resp.on('data', (chunk: Buffer) => chunks.push(chunk));
        resp.on('end', () => resolve(Buffer.concat(chunks)));
        resp.on('error', reject);
      }
    );
    req.on('error', reject);
  });
};

const resolveTrackSource = async (filePath: string): Promise<string | null> => {
  if (storageService.isOSS()) {
    const ossService = (await import('../services/ossService')).default;
    return await ossService.getSignedUrl(filePath, 300);
  }

  if (storageService.isWebDAV()) {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    return null;
  }

  const fullPath = storageService.getFullPath(filePath);
  return fs.existsSync(fullPath) ? fullPath : null;
};

const readTrackHeadBuffer = async (filePath: string): Promise<Buffer | null> => {
  const source = await resolveTrackSource(filePath);
  if (!source) {
    return null;
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return await fetchBufferFromUrl(source, REMOTE_READ_BYTES);
  }

  const fd = fs.openSync(source, 'r');
  try {
    const buffer = Buffer.alloc(REMOTE_READ_BYTES);
    const bytesRead = fs.readSync(fd, buffer, 0, REMOTE_READ_BYTES, 0);
    return buffer.slice(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
};

const normalizeBpm = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  if (rounded < BPM_MIN || rounded > BPM_MAX) return null;
  return rounded;
};

const normalizeConfidence = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
};

const detectBpmByPythonAnalyzer = async (source: string): Promise<Omit<BpmDetection, 'method'> & { method: 'essentia' | 'librosa' } | null> => {
  if (!fs.existsSync(BPM_ANALYZER_SCRIPT)) {
    return null;
  }

  const pythonBin = process.env.BPM_PYTHON || 'python';
  const analyzerMethod = process.env.BPM_ANALYZER || 'auto';

  return await new Promise<Omit<BpmDetection, 'method'> & { method: 'essentia' | 'librosa' } | null>((resolve) => {
    const child = spawn(
      pythonBin,
      [
        BPM_ANALYZER_SCRIPT,
        '--input', source,
        '--method', analyzerMethod,
        '--duration', '120',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const done = (result: Omit<BpmDetection, 'method'> & { method: 'essentia' | 'librosa' } | null) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // no-op
      }
      done(null);
    }, BPM_ANALYZER_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      clearTimeout(timer);
      done(null);
    });

    child.on('close', () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse((stdout || '{}').trim());
        const bpm = normalizeBpm(parsed?.bpm);
        const method = parsed?.method === 'essentia' ? 'essentia' : parsed?.method === 'librosa' ? 'librosa' : null;
        if (!bpm || !method) {
          done(null);
          return;
        }

        done({
          bpm,
          confidence: normalizeConfidence(parsed?.confidence),
          method,
        });
      } catch {
        if (stderr) {
          console.warn('BPM analyzer stderr:', stderr.slice(0, 300));
        }
        done(null);
      }
    });
  });
};

const detectBpmFromTrack = async (filePath: string): Promise<BpmDetection | null> => {
  const source = await resolveTrackSource(filePath);
  if (source) {
    const analyzerResult = await detectBpmByPythonAnalyzer(source);
    if (analyzerResult) {
      return analyzerResult;
    }
  }

  const buffer = await readTrackHeadBuffer(filePath);
  if (!buffer || buffer.length === 0) return null;

  const metadata = await parseBuffer(buffer);
  const commonBpm = normalizeBpm((metadata.common as any).bpm);
  if (commonBpm) {
    return { bpm: commonBpm, confidence: null, method: 'metadata' };
  }

  for (const [, tags] of Object.entries(metadata.native || {})) {
    for (const tag of tags) {
      const tagId = String(tag.id || '').toLowerCase();
      if (tagId !== 'tbpm' && tagId !== 'bpm') continue;
      const numeric = typeof tag.value === 'number' ? tag.value : Number(tag.value);
      const normalized = normalizeBpm(numeric);
      if (normalized) {
        return { bpm: normalized, confidence: null, method: 'metadata' };
      }
    }
  }

  return null;
};

// Get all albums with track count
export const getAlbums = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';

    // Cache non-search paginated results
    const cacheKey = search ? null : `albums:p${page}:l${limit}`;
    if (cacheKey) {
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);
    }

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
      ORDER BY COALESCE(a.release_date, a.created_at) DESC, a.title ASC
      LIMIT $1 OFFSET $2
    `;

    const albumsResult = await pool.query(albumsQuery, queryParams);

    const response = {
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
    };
    if (cacheKey) cache.set(cacheKey, response, 300); // 5 min
    res.json(response);
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
        ad.disc_number,
        ad.disc_title,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      LEFT JOIN album_discs ad ON t.disc_id = ad.id
      WHERE t.album_id = $1
      GROUP BY t.id, ad.disc_number, ad.disc_title
      ORDER BY ad.disc_number ASC NULLS LAST, t.track_number ASC, t.title ASC
    `;
    const tracksResult = await pool.query(tracksQuery, [id]);

    const tracks = tracksResult.rows.map(row => ({
      ...row,
      artists: row.artists.filter((a: any) => a.id !== null),
    }));

    // Get discs for this album
    const discsResult = await pool.query(
      `SELECT * FROM album_discs WHERE album_id = $1 ORDER BY disc_number ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        album,
        tracks,
        discs: discsResult.rows,
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
    const { title, release_date, game_id, notes } = req.body;

    const result = await pool.query(
      `UPDATE albums 
       SET title = $1, release_date = $2, game_id = $3, notes = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
      [title, release_date, game_id || null, notes !== undefined ? notes : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    cache.invalidatePattern('albums');
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

    // Generate and upload thumbnails (non-blocking, failures don't break the upload)
    try {
      const thumbnails = await generateThumbnails(req.file.buffer);
      for (const thumb of thumbnails) {
        const thumbPath = deriveThumbnailPath(req.file.originalname, thumb.suffix);
        await storageService.uploadFile(thumb.buffer, thumbPath, 'covers', 'image/jpeg');
      }
    } catch (thumbErr) {
      console.warn('Thumbnail generation failed (non-fatal):', thumbErr);
    }

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

    cache.invalidatePattern('albums');
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

// Bulk update game for albums
export const bulkUpdateGame = async (req: Request, res: Response) => {
  try {
    const { albumIds, gameId } = req.body;
    if (!Array.isArray(albumIds) || albumIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供专辑ID列表' }
      });
    }

    await pool.query(
      'UPDATE albums SET game_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)',
      [gameId || null, albumIds]
    );

    cache.invalidatePattern('albums');
    res.json({
      success: true,
      data: { updated: albumIds.length, message: `成功设置 ${albumIds.length} 张专辑的游戏` }
    });
  } catch (error) {
    console.error('Bulk update game error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: '批量设置游戏失败' }
    });
  }
};

// Rescan release dates from FLAC metadata for all tracks in an album
export const rescanDates = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tracksResult = await pool.query(
      'SELECT id, file_path FROM tracks WHERE album_id = $1',
      [id]
    );

    if (tracksResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_TRACKS', message: '该专辑没有曲目' }
      });
    }

    let updated = 0;
    let albumDate: string | null = null;

    for (const track of tracksResult.rows) {
      try {
        let buffer: Buffer;

        if (storageService.isOSS()) {
          const ossService = (await import('../services/ossService')).default;
          const signedUrl = await ossService.getSignedUrl(track.file_path, 300);
          buffer = await new Promise<Buffer>((resolve, reject) => {
            const proto = signedUrl.startsWith('https') ? https : http;
            proto.get(signedUrl, { headers: { 'Range': 'bytes=0-262143' } }, (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (chunk: Buffer) => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
              res.on('error', reject);
            }).on('error', reject);
          });
        } else if (storageService.isWebDAV()) {
          continue;
        } else {
          const fullPath = storageService.getFullPath(track.file_path);
          if (!fs.existsSync(fullPath)) continue;
          const fd = fs.openSync(fullPath, 'r');
          buffer = Buffer.alloc(262144);
          const bytesRead = fs.readSync(fd, buffer, 0, 262144, 0);
          fs.closeSync(fd);
          buffer = buffer.slice(0, bytesRead);
        }

        const metadata = await parseBuffer(buffer, { mimeType: 'audio/flac' });

        let releaseDate: Date | null = null;
        const dateStr = (metadata.common as any).date;
        if (dateStr && typeof dateStr === 'string') {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) releaseDate = parsed;
        }
        if (!releaseDate && metadata.native) {
          for (const [, tags] of Object.entries(metadata.native)) {
            for (const tag of tags) {
              const tagId = tag.id.toLowerCase();
              if (tagId === 'date' || tagId === 'tdrc' || tagId === 'originaldate') {
                const val = typeof tag.value === 'string' ? tag.value : '';
                if (val && val.length >= 10) {
                  const parsed = new Date(val);
                  if (!isNaN(parsed.getTime())) { releaseDate = parsed; break; }
                }
              }
            }
            if (releaseDate) break;
          }
        }
        if (!releaseDate && metadata.common.year) {
          releaseDate = new Date(metadata.common.year, 0, 1);
        }

        if (releaseDate) {
          await pool.query(
            'UPDATE tracks SET release_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [releaseDate, track.id]
          );
          updated++;
          if (!albumDate) albumDate = releaseDate.toISOString();
        }
      } catch (err) {
        console.error(`Error rescanning date for track ${track.id}:`, err);
      }
    }

    if (albumDate) {
      await pool.query(
        'UPDATE albums SET release_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [albumDate, id]
      );
    }

    res.json({
      success: true,
      data: { updated, message: `成功更新 ${updated} 首曲目的发行日期` }
    });
  } catch (error) {
    console.error('Rescan dates error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'RESCAN_ERROR', message: '重新读取日期失败' }
    });
  }
};

// Detect BPM for all tracks in an album and write as BPM-group tags (e.g. 128BPM)
export const detectAlbumBpm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const albumCheck = await pool.query('SELECT id, title FROM albums WHERE id = $1', [id]);
    if (albumCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Album not found' }
      });
    }

    const tracksResult = await pool.query(
      `SELECT id, title, file_path FROM tracks WHERE album_id = $1 ORDER BY track_number ASC NULLS LAST, id ASC`,
      [id]
    );

    if (tracksResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_TRACKS', message: '该专辑没有曲目' }
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let bpmGroupId: number;
      const groupResult = await client.query(
        `SELECT id FROM tag_groups WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [BPM_GROUP_NAME]
      );

      if (groupResult.rows.length > 0) {
        bpmGroupId = groupResult.rows[0].id;
      } else {
        const createdGroup = await client.query(
          `INSERT INTO tag_groups (name, description, icon, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [BPM_GROUP_NAME, 'Auto-generated BPM labels', 'DashboardOutlined', 90]
        );
        bpmGroupId = createdGroup.rows[0].id;
      }

      const existingBpmTags = await client.query(
        `SELECT id, name FROM tags WHERE group_id = $1`,
        [bpmGroupId]
      );
      const tagIdByName = new Map<string, number>(
        existingBpmTags.rows.map((row) => [row.name.toUpperCase(), row.id])
      );

      const details: Array<{
        track_id: number;
        title: string;
        bpm: number | null;
        confidence: number | null;
        method: 'essentia' | 'librosa' | 'metadata' | null;
        low_confidence: boolean;
        tag: string | null;
        status: string;
        reason?: string;
      }> = [];
      let tagged = 0;
      let lowConfidenceTagged = 0;

      for (const track of tracksResult.rows) {
        try {
          const detection = await detectBpmFromTrack(track.file_path);
          if (!detection) {
            details.push({
              track_id: track.id,
              title: track.title,
              bpm: null,
              confidence: null,
              method: null,
              low_confidence: false,
              tag: null,
              status: 'skipped',
              reason: '未读取到有效BPM'
            });
            continue;
          }

          const tagName = `${detection.bpm}BPM`;
          const normalizedTag = tagName.toUpperCase();
          let tagId = tagIdByName.get(normalizedTag);

          if (!tagId) {
            try {
              const createdTag = await client.query(
                `INSERT INTO tags (name, color, description, group_id, display_order)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [tagName, BPM_TAG_COLOR, 'Auto-generated by BPM detector', bpmGroupId, detection.bpm]
              );
              tagId = createdTag.rows[0].id;
              if (tagId) {
                tagIdByName.set(normalizedTag, tagId);
              }
            } catch (tagErr: any) {
              if (tagErr.code === '23505') {
                const existingTagByName = await client.query(
                  `SELECT id FROM tags WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                  [tagName]
                );
                if (existingTagByName.rows.length > 0) {
                  tagId = existingTagByName.rows[0].id;
                  if (tagId) {
                    tagIdByName.set(normalizedTag, tagId);
                  }
                } else {
                  throw tagErr;
                }
              } else {
                throw tagErr;
              }
            }
          }

          if (!tagId) {
            throw new Error('BPM tag creation failed');
          }

          await client.query(
            `DELETE FROM track_tags tt
             USING tags t
             WHERE tt.track_id = $1
               AND tt.tag_id = t.id
               AND t.group_id = $2`,
            [track.id, bpmGroupId]
          );

          await client.query(
            `INSERT INTO track_tags (track_id, tag_id)
             VALUES ($1, $2)
             ON CONFLICT (track_id, tag_id) DO NOTHING`,
            [track.id, tagId]
          );

          const lowConfidence = detection.confidence != null && detection.confidence < BPM_LOW_CONFIDENCE_THRESHOLD;
          if (lowConfidence) {
            lowConfidenceTagged += 1;
          }

          tagged += 1;
          details.push({
            track_id: track.id,
            title: track.title,
            bpm: detection.bpm,
            confidence: detection.confidence,
            method: detection.method,
            low_confidence: lowConfidence,
            tag: tagName,
            status: 'tagged'
          });
        } catch (trackError: any) {
          details.push({
            track_id: track.id,
            title: track.title,
            bpm: null,
            confidence: null,
            method: null,
            low_confidence: false,
            tag: null,
            status: 'failed',
            reason: trackError?.message || 'BPM分析失败'
          });
        }
      }

      await client.query('COMMIT');
      cache.invalidate('tags:all');

      res.json({
        success: true,
        data: {
          album_id: Number(id),
          album_title: albumCheck.rows[0].title,
          total: tracksResult.rows.length,
          tagged,
          low_confidence_tagged: lowConfidenceTagged,
          skipped: details.filter((d) => d.status === 'skipped').length,
          failed: details.filter((d) => d.status === 'failed').length,
          details
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Detect album BPM error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'BPM_DETECT_ERROR', message: '批量BPM检测失败' }
    });
  }
};

