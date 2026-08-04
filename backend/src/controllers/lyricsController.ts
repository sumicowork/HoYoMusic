import { Request, Response } from 'express';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';
import path from 'path';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import storageService from '../services/storageService';
import remoteResourceCache from '../services/remoteResourceCache';

const buildLyricsCacheKey = (lyricsPath: string) => `lyrics:${lyricsPath}`;
type LyricsStatus = 'none' | 'has' | 'instrumental';
const LYRICS_STATUS = {
  NONE: 'none' as LyricsStatus,
  HAS: 'has' as LyricsStatus,
  INSTRUMENTAL: 'instrumental' as LyricsStatus,
};

const normalizeLyricsStatus = (raw: unknown): LyricsStatus => {
  if (raw === LYRICS_STATUS.HAS || raw === LYRICS_STATUS.INSTRUMENTAL || raw === LYRICS_STATUS.NONE) {
    return raw as LyricsStatus;
  }
  return LYRICS_STATUS.NONE;
};

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

// Keep the original filename text (except extension) for matching.
const normalizeLyricBaseName = (baseName: string): string => baseName.trim();

const getUploadedLyricsFiles = (req: Request): Express.Multer.File[] => {
  const files = req.files;
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return [];
};

const decodePossibleMojibake = (name: string): string => {
  const normalized = name.replace(/\\/g, '/');
  try {
    const decoded = Buffer.from(normalized, 'latin1').toString('utf8');
    const originalHasCjk = /[\u4e00-\u9fff]/.test(normalized);
    const decodedHasCjk = /[\u4e00-\u9fff]/.test(decoded);
    if (!originalHasCjk && decodedHasCjk) {
      return decoded;
    }
  } catch {
    // Keep original value.
  }
  return normalized;
};

const normalizeOriginalPath = (originalname: string): string => decodePossibleMojibake(originalname);

const getSafeOriginalName = (originalname: string): string => path.basename(normalizeOriginalPath(originalname));

const resolveLyricsFileName = (lyricsPath: string | null | undefined): string => {
  const fallback = `${uuidv4()}.lrc`;
  if (!lyricsPath) return fallback;

  try {
    if (lyricsPath.startsWith('http://') || lyricsPath.startsWith('https://')) {
      const parsed = new URL(lyricsPath);
      const fromUrl = path.basename(parsed.pathname);
      if (fromUrl) return fromUrl;
      return fallback;
    }
  } catch {
    // Fallback to generic basename parsing.
  }

  const fileName = path.basename(lyricsPath);
  if (!fileName) return fallback;
  if (!path.extname(fileName)) return `${fileName}.lrc`;
  return fileName;
};

const getLyricsUpdateErrorMessage = (error: unknown): string => {
  const maybeErr = error as { code?: string; message?: string };

  if (maybeErr?.code === 'ENOENT') {
    return 'Original lyrics file was not found on storage. Please re-upload lyrics.';
  }
  if (maybeErr?.code === 'EACCES' || maybeErr?.code === 'EPERM') {
    return 'Storage permission denied while updating lyrics.';
  }
  if (typeof maybeErr?.message === 'string' && maybeErr.message.trim()) {
    return `Lyrics update failed: ${maybeErr.message}`;
  }
  return 'Failed to update lyrics due to a storage or database error.';
};

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
       COALESCE(
         (SELECT array_to_string(array_agg(DISTINCT credit_value), ' / ')
          FROM track_credits WHERE track_id = t.id AND credit_value IS NOT NULL AND credit_value <> ''),
         ''
       ) AS artists
     FROM tracks t
     LEFT JOIN albums al ON t.album_id = al.id
     WHERE TRIM(t.title) = TRIM($1)
        OR LOWER(TRIM(t.title)) = LOWER(TRIM($1))
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
    'UPDATE tracks SET lyrics_path = $1, lyrics_status = $2, lyrics_analysis_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [nextLyricsPath, LYRICS_STATUS.HAS, 'pending', trackId]
  );

  if (oldLyricsPath) {
    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(oldLyricsPath));
  }
  await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(nextLyricsPath));

  return nextLyricsPath;
};

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

    const lyricsPath = await storageService.uploadFile(
      Buffer.from(lyricsContent, 'utf-8'),
      `${uuidv4()}.lrc`,
      'lyrics',
      'text/plain; charset=utf-8'
    );

    // Update track record
    await pool.query(
      'UPDATE tracks SET lyrics_path = $1, lyrics_status = $2, lyrics_analysis_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [lyricsPath, LYRICS_STATUS.HAS, 'pending', id]
    );

    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(lyricsPath));

    res.json({
      success: true,
      data: {
        lyrics_path: lyricsPath,
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
      const normalizedPath = normalizeOriginalPath(file.originalname);
      const displayName = getSafeOriginalName(normalizedPath);
      const fileKey = normalizedPath;
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
      const normalizedPath = normalizeOriginalPath(file.originalname);
      const displayName = getSafeOriginalName(normalizedPath);
      const fileKey = normalizedPath;
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
        const selectedTrackId = resolutions[fileKey] || resolutions[displayName] || resolutions[file.originalname];
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
    const useRaw = req.query.raw === '1';

    const trackResult = await pool.query(
      'SELECT lyrics_path, lyrics_status, lyrics_text FROM tracks WHERE id = $1',
      [id]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const { lyrics_path, lyrics_text } = trackResult.rows[0];
    const lyricsStatus = normalizeLyricsStatus(trackResult.rows[0].lyrics_status);

    // 优先返回 AI 清洗后的歌词（lyrics_text）；管理后台编辑器传 raw=1 拿原始文件
    if (!useRaw && lyrics_text && lyrics_text.trim()) {
      return res.json({
        success: true,
        data: {
          lyrics: lyrics_text,
          lyrics_path,
          lyrics_status: lyricsStatus,
          lyrics_source: 'cleaned',
        },
      });
    }

    if (!lyrics_path) {
      return res.status(404).json({
        success: false,
        error: {
          code: lyricsStatus === LYRICS_STATUS.INSTRUMENTAL ? 'INSTRUMENTAL_TRACK' : 'NO_LYRICS',
          message: lyricsStatus === LYRICS_STATUS.INSTRUMENTAL
            ? 'This track is marked as instrumental'
            : 'No lyrics available for this track'
        }
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
      const filePath = storageService.getFullPath(lyrics_path);
      lyricsContent = await fs.readFile(filePath, 'utf-8');
    }

    res.json({
      success: true,
      data: {
        lyrics: lyricsContent,
        lyrics_path,
        lyrics_status: lyricsStatus,
        lyrics_source: 'raw',
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
    const mode = req.body.mode;

    if (!lyricsContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_LYRICS', message: 'No lyrics content provided' }
      });
    }

    // 清洗模式：编辑器编辑的是最终展示歌词——直接更新 lyrics_text，不碰原始文件/不重跑 AI
    if (mode === 'cleaned') {
      await pool.query(
        `UPDATE tracks
         SET lyrics_text = $1,
             lyrics_status = 'has',
             lyrics_analysis_status = 'done',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [lyricsContent, id]
      );
      return res.json({
        success: true,
        data: {
          lyrics_status: LYRICS_STATUS.HAS,
          lyrics_source: 'cleaned',
          message: 'Lyrics updated successfully',
        },
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

    // 编辑保存后重置 pending：worker 重新 AI 清洗/分类，刷新 lyrics_text（展示层数据）
    const requeue = `
      UPDATE tracks
      SET lyrics_status = $1,
          lyrics_analysis_status = 'pending',
          lyrics_text = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`;

    if (storageService.isLocal()) {
      // Local mode updates in place to keep path stable.
      const filePath = storageService.getFullPath(lyrics_path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, lyricsContent, 'utf-8');

      await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(lyrics_path));
      await pool.query(requeue, [LYRICS_STATUS.HAS, id]);

      return res.json({
        success: true,
        data: {
          lyrics_path,
          lyrics_status: LYRICS_STATUS.HAS,
          message: 'Lyrics updated successfully'
        }
      });
    }

    // Remote storage mode re-uploads content and updates DB path safely.
    const nextLyricsPath = await storageService.uploadFile(
      Buffer.from(lyricsContent, 'utf-8'),
      resolveLyricsFileName(lyrics_path),
      'lyrics',
      'text/plain; charset=utf-8'
    );

    await pool.query(
      'UPDATE tracks SET lyrics_path = $1, lyrics_status = $2, lyrics_analysis_status = $3, lyrics_text = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [nextLyricsPath, LYRICS_STATUS.HAS, 'pending', id]
    );

    if (lyrics_path && lyrics_path !== nextLyricsPath) {
      await storageService.deleteFile(lyrics_path).catch((deleteError) => {
        console.warn('Delete old lyrics file failed after remote update:', deleteError);
      });
    }

    if (lyrics_path) {
      await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(lyrics_path));
    }
    await remoteResourceCache.deleteBinary('lyrics', buildLyricsCacheKey(nextLyricsPath));

    res.json({
      success: true,
      data: {
        lyrics_path: nextLyricsPath,
        lyrics_status: LYRICS_STATUS.HAS,
        message: 'Lyrics updated successfully'
      }
    });
  } catch (error) {
    console.error('Update lyrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: getLyricsUpdateErrorMessage(error)
      }
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
        await storageService.deleteFile(lyrics_path);
      } catch (fileError) {
        console.error('Error deleting lyrics file:', fileError);
      }
    }

    // Update database
    await pool.query(
      "UPDATE tracks SET lyrics_path = NULL, lyrics_status = $1, lyrics_text = NULL, lyrics_analysis_status = 'none', updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [LYRICS_STATUS.NONE, id]
    );

    res.json({
      success: true,
      data: { message: 'Lyrics deleted successfully', lyrics_status: LYRICS_STATUS.NONE }
    });
  } catch (error) {
    console.error('Delete lyrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete lyrics' }
    });
  }
};

// Mark track as instrumental (no lyrics expected)
export const markTrackInstrumental = async (req: Request, res: Response) => {
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
      await storageService.deleteFile(lyrics_path).catch((fileError) => {
        console.warn('Delete lyrics file failed while marking instrumental:', fileError);
      });
    }

    await pool.query(
      "UPDATE tracks SET lyrics_path = NULL, lyrics_status = $1, lyrics_text = NULL, lyrics_analysis_status = 'none', updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [LYRICS_STATUS.INSTRUMENTAL, id]
    );

    res.json({
      success: true,
      data: {
        message: 'Track marked as instrumental',
        lyrics_status: LYRICS_STATUS.INSTRUMENTAL,
      },
    });
  } catch (error) {
    console.error('Mark track instrumental error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INSTRUMENTAL_MARK_ERROR', message: 'Failed to mark track as instrumental' },
    });
  }
};

