import { Request, Response } from 'express';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';
import path from 'path';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import storageService from '../services/storageService';
import remoteResourceCache from '../services/remoteResourceCache';

const LYRICS_DIR = path.join(process.cwd(), 'uploads', 'lyrics');
const buildLyricsCacheKey = (lyricsPath: string) => `lyrics:${lyricsPath}`;

type LyricsImportStatus = 'matched' | 'ambiguous' | 'not_found' | 'invalid' | 'imported' | 'error';

interface LyricsImportCandidate {
  track_id: number;
  title: string;
  album_title: string;
  artists: string;
}

interface LyricsImportItem {
  file_key: string;
  file_name: string;
  inferred_title: string;
  status: LyricsImportStatus;
  message?: string;
  matched_track_id?: number;
  candidates?: LyricsImportCandidate[];
}

const normalizeLyricBaseName = (baseName: string): string =>
  baseName
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getUploadedLyricsFiles = (req: Request): Express.Multer.File[] => {
  const files = req.files;
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return [];
};

const getSafeOriginalName = (originalname: string): string => path.basename(originalname.replace(/\\/g, '/'));

const parseResolutions = (raw: unknown): Record<string, number> => {
  if (!raw) return {};

  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const trackId = Number(value);
    if (key && Number.isInteger(trackId) && trackId > 0) {
      result[key] = trackId;
    }
  }
  return result;
};

const queryTrackCandidates = async (normalizedTitle: string): Promise<LyricsImportCandidate[]> => {
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title,
       COALESCE(al.title, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists
     FROM tracks t
     LEFT JOIN albums al ON t.album_id = al.id
     LEFT JOIN track_artists ta ON t.id = ta.track_id
     LEFT JOIN artists ar ON ta.artist_id = ar.id
     WHERE LOWER(REGEXP_REPLACE(TRIM(t.title), '[[:space:]._-]+', ' ', 'g')) = $1
     GROUP BY t.id, t.title, al.title
     ORDER BY t.id ASC`,
    [normalizedTitle]
  );

  return result.rows.map((row) => ({
    track_id: Number(row.track_id),
    title: String(row.title),
    album_title: String(row.album_title || ''),
    artists: String(row.artists || ''),
  }));
};

const saveLyricsForTrack = async (trackId: number, file: Express.Multer.File): Promise<string> => {
  const oldResult = await pool.query('SELECT lyrics_path FROM tracks WHERE id = $1', [trackId]);
  const oldLyricsPath = oldResult.rows[0]?.lyrics_path as string | null | undefined;

  const nextLyricsPath = await storageService.uploadFile(
    file.buffer,
    getSafeOriginalName(file.originalname),
    'lyrics',
    'text/plain; charset=utf-8'
  );

  await pool.query(
    'UPDATE tracks SET lyrics_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [nextLyricsPath, trackId]
  );

  if (oldLyricsPath) {
    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(oldLyricsPath));
  }
  await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(nextLyricsPath));

  return nextLyricsPath;
};

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

    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(relativePath));

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

// Preview batch LRC import by matching filename -> track title
export const previewLyricsBatchImport = async (req: Request, res: Response) => {
  try {
    const files = getUploadedLyricsFiles(req);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No LRC files uploaded' },
      });
    }

    const items: LyricsImportItem[] = [];

    for (const file of files) {
      const displayName = getSafeOriginalName(file.originalname);
      const fileKey = file.originalname;
      const inferredTitle = normalizeLyricBaseName(path.parse(displayName).name);

      if (!inferredTitle) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: '',
          status: 'invalid',
          message: 'Filename cannot be parsed to a valid title',
        });
        continue;
      }

      const candidates = await queryTrackCandidates(inferredTitle);
      if (candidates.length === 0) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'not_found',
          message: 'No track matched this filename',
        });
        continue;
      }

      if (candidates.length === 1) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'matched',
          matched_track_id: candidates[0].track_id,
          candidates,
        });
        continue;
      }

      items.push({
        file_key: fileKey,
        file_name: displayName,
        inferred_title: inferredTitle,
        status: 'ambiguous',
        message: 'Multiple tracks matched. Please choose one before import.',
        candidates,
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          matched: items.filter((item) => item.status === 'matched').length,
          ambiguous: items.filter((item) => item.status === 'ambiguous').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Preview lyrics batch import error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PREVIEW_ERROR', message: 'Failed to preview lyrics import' },
    });
  }
};

// Commit batch LRC import, resolving ambiguous matches with user selections
export const commitLyricsBatchImport = async (req: Request, res: Response) => {
  try {
    const files = getUploadedLyricsFiles(req);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No LRC files uploaded' },
      });
    }

    const resolutions = parseResolutions(req.body?.resolutions);
    const items: LyricsImportItem[] = [];

    for (const file of files) {
      const displayName = getSafeOriginalName(file.originalname);
      const fileKey = file.originalname;
      const inferredTitle = normalizeLyricBaseName(path.parse(displayName).name);
      if (!inferredTitle) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: '',
          status: 'invalid',
          message: 'Filename cannot be parsed to a valid title',
        });
        continue;
      }

      const candidates = await queryTrackCandidates(inferredTitle);
      if (candidates.length === 0) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'not_found',
          message: 'No track matched this filename',
        });
        continue;
      }

      let targetTrackId: number | null = null;
      if (candidates.length === 1) {
        targetTrackId = candidates[0].track_id;
      } else {
        const selectedTrackId = resolutions[fileKey] || resolutions[displayName];
        const selectedValid = candidates.some((candidate) => candidate.track_id === selectedTrackId);
        if (!selectedValid) {
          items.push({
            file_key: fileKey,
            file_name: displayName,
            inferred_title: inferredTitle,
            status: 'ambiguous',
            message: 'Multiple tracks matched. Please choose one track.',
            candidates,
          });
          continue;
        }
        targetTrackId = selectedTrackId;
      }

      if (targetTrackId === null) {
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'error',
          message: 'Unable to resolve target track',
          candidates,
        });
        continue;
      }

      try {
        await saveLyricsForTrack(targetTrackId, file);
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'imported',
          matched_track_id: targetTrackId,
          candidates,
        });
      } catch (error) {
        console.error(`Commit lyrics import failed for ${displayName}:`, error);
        items.push({
          file_key: fileKey,
          file_name: displayName,
          inferred_title: inferredTitle,
          status: 'error',
          message: 'Failed to save lyrics',
          matched_track_id: targetTrackId,
        });
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          imported: items.filter((item) => item.status === 'imported').length,
          ambiguous: items.filter((item) => item.status === 'ambiguous').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
          error: items.filter((item) => item.status === 'error').length,
        },
        items,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SELECTIONS', message: 'resolutions must be valid JSON' },
      });
    }

    console.error('Commit lyrics batch import error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_ERROR', message: 'Failed to import lyrics' },
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

    let lyricsContent: string;

    if (storageService.isOSS() && (lyrics_path.startsWith('http://') || lyrics_path.startsWith('https://'))) {
      const cacheKey = buildLyricsCacheKey(lyrics_path);
      const cached = await remoteResourceCache.getBinary('lyrics', cacheKey);
      if (cached) {
        lyricsContent = cached.buffer.toString('utf-8');
      } else {
      // OSS 模式：用签名 URL 从 OSS 拉取歌词内容
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(lyrics_path, 300);
      const lyricBuffer = await new Promise<Buffer>((resolve, reject) => {
        const client = signedUrl.startsWith('https') ? https : http;
        client.get(signedUrl, (ossRes) => {
          if (ossRes.statusCode !== 200) {
            return reject(new Error(`OSS returned ${ossRes.statusCode}`));
          }
          const chunks: Buffer[] = [];
          ossRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          ossRes.on('end', () => resolve(Buffer.concat(chunks)));
          ossRes.on('error', reject);
        }).on('error', reject);
      });
      lyricsContent = lyricBuffer.toString('utf-8');
      await remoteResourceCache.setBinary('lyrics', cacheKey, {
        buffer: lyricBuffer,
        contentType: 'text/plain; charset=utf-8',
      });
      }
    } else {
      // 本地存储模式：读取本地文件
      const filePath = path.join(process.cwd(), 'uploads', lyrics_path);
      lyricsContent = await fs.readFile(filePath, 'utf-8');
    }

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

    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(lyrics_path));

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
      await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(lyrics_path));

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

