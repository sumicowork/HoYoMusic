import { Request, Response } from 'express';
import { parseBuffer } from 'music-metadata';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { randomUUID } from 'crypto';
import pool from '../config/database';
import { TrackWithDetails } from '../types';
import storageService from '../services/storageService';
import { toStringList } from '../utils/metadata';

const FLAC_MAGIC = Buffer.from('fLaC', 'ascii');

const isValidFlacBuffer = (buffer: Buffer): boolean => {
  // FLAC stream marker must be at byte 0.
  return buffer.length >= FLAC_MAGIC.length && buffer.subarray(0, FLAC_MAGIC.length).equals(FLAC_MAGIC);
};

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

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

type TrackNotesImportStatus = 'matched' | 'needs_manual' | 'not_found' | 'invalid' | 'imported' | 'skipped' | 'error';

interface TrackNotesImportCandidate {
  track_id: number;
  title: string;
  track_number: number | null;
  album_title: string;
  artists: string;
}

interface TrackNotesImportEntry {
  row_key: string;
  song_name: string;
  song_number?: string | number | null;
  note_lines: string[];
}

interface TrackNotesImportItem {
  row_key: string;
  song_name: string;
  song_number_raw: string;
  status: TrackNotesImportStatus;
  message?: string;
  matched_track_id?: number;
  note_lines_count: number;
  candidates?: TrackNotesImportCandidate[];
}

interface ExportTrackNotesRow {
  track_id: number;
  album_title: string | null;
  track_title: string;
  track_number: number | null;
  notes: string;
}

interface CatalogAlbumExportRow {
  id: number;
  uuid: string;
  title: string;
  title_cn: string | null;
  title_en: string | null;
  game_id: number | null;
  release_date: Date | null;
  notes: string | null;
}

interface CatalogTrackExportRow {
  id: number;
  uuid: string;
  title: string;
  title_cn: string | null;
  title_en: string | null;
  album_id: number | null;
  album_uuid: string | null;
  track_number: number | null;
  release_date: Date | null;
  notes: string | null;
}

type CatalogEntityType = 'album' | 'track';

interface CatalogMetadataImportItemResult {
  entity_type: CatalogEntityType;
  uuid: string;
  status: 'updated' | 'not_found' | 'skipped';
  entity_id?: number;
  reason?: string;
}

const normalizeTrackNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.match(/\d+/)?.[0];
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeNotesText = (lines: string[]): string => lines.map((line) => line.trim()).filter(Boolean).join('\n');

const mapTrackCandidateRow = (row: any): TrackNotesImportCandidate => ({
  track_id: Number(row.track_id),
  title: String(row.title),
  track_number: row.track_number === null || row.track_number === undefined ? null : Number(row.track_number),
  album_title: String(row.album_title || ''),
  artists: String(row.artists || ''),
});

const queryStrictTrackMatch = async (songName: string, trackNumber: number): Promise<TrackNotesImportCandidate[]> => {
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title,
       t.track_number,
       COALESCE(al.title, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists
     FROM tracks t
     LEFT JOIN albums al ON al.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE LOWER(TRIM(t.title)) = LOWER(TRIM($1))
       AND t.track_number = $2
     GROUP BY t.id, t.title, t.track_number, al.title
     ORDER BY t.id ASC`,
    [songName, trackNumber]
  );

  return result.rows.map(mapTrackCandidateRow);
};

const queryManualTrackCandidates = async (songName: string, trackNumber: number | null): Promise<TrackNotesImportCandidate[]> => {
  const useTrackNumber = Number.isInteger(trackNumber) && (trackNumber as number) > 0;
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title,
       t.track_number,
       COALESCE(al.title, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists,
       CASE
         WHEN LOWER(TRIM(t.title)) = LOWER(TRIM($1)) AND t.track_number = $2 THEN 0
         WHEN LOWER(TRIM(t.title)) = LOWER(TRIM($1)) THEN 1
         WHEN $3::boolean AND t.track_number = $2 THEN 2
         ELSE 3
       END AS match_rank
     FROM tracks t
     LEFT JOIN albums al ON al.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE LOWER(TRIM(t.title)) = LOWER(TRIM($1))
        OR ($3::boolean AND t.track_number = $2)
     GROUP BY t.id, t.title, t.track_number, al.title
     ORDER BY match_rank ASC, t.id ASC
     LIMIT 30`,
    [songName, trackNumber, useTrackNumber]
  );

  return result.rows.map(mapTrackCandidateRow);
};

const queryTrackCandidateById = async (trackId: number): Promise<TrackNotesImportCandidate | null> => {
  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title,
       t.track_number,
       COALESCE(al.title, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists
     FROM tracks t
     LEFT JOIN albums al ON al.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE t.id = $1
     GROUP BY t.id, t.title, t.track_number, al.title
     LIMIT 1`,
    [trackId]
  );

  if (result.rows.length === 0) return null;
  return mapTrackCandidateRow(result.rows[0]);
};

const searchTrackCandidatesForNotesImport = async (keyword: string, limit: number): Promise<TrackNotesImportCandidate[]> => {
  const normalizedKeyword = keyword.trim();
  const numericKeyword = Number.parseInt(normalizedKeyword, 10);
  const hasNumericKeyword = Number.isInteger(numericKeyword) && numericKeyword > 0;

  const result = await pool.query(
    `SELECT
       t.id AS track_id,
       t.title,
       t.track_number,
       COALESCE(al.title, '') AS album_title,
       COALESCE(array_to_string(array_agg(DISTINCT ar.name), ' / '), '') AS artists,
       CASE
         WHEN LOWER(TRIM(t.title)) = LOWER(TRIM($1)) THEN 0
         WHEN $3::boolean AND t.id = $4 THEN 1
         WHEN $3::boolean AND t.track_number = $4 THEN 2
         ELSE 3
       END AS match_rank
     FROM tracks t
     LEFT JOIN albums al ON al.id = t.album_id
     LEFT JOIN track_artists ta ON ta.track_id = t.id
     LEFT JOIN artists ar ON ar.id = ta.artist_id
     WHERE LOWER(t.title) LIKE LOWER($2)
        OR LOWER(COALESCE(al.title, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(ar.name, '')) LIKE LOWER($2)
        OR ($3::boolean AND t.id = $4)
        OR ($3::boolean AND t.track_number = $4)
     GROUP BY t.id, t.title, t.track_number, al.title
     ORDER BY match_rank ASC, t.id ASC
     LIMIT $5`,
    [normalizedKeyword, `%${normalizedKeyword}%`, hasNumericKeyword, hasNumericKeyword ? numericKeyword : null, limit]
  );

  return result.rows.map(mapTrackCandidateRow);
};

const resolveTrackForNotesImport = async (
  entry: TrackNotesImportEntry,
  resolutions: Record<string, number>
): Promise<{ status: 'matched' | 'needs_manual' | 'not_found' | 'invalid'; matched_track_id?: number; message?: string; candidates?: TrackNotesImportCandidate[]; trackNumber: number | null; notesText: string; noteLinesCount: number }> => {
  const songName = String(entry.song_name || '').trim();
  const trackNumber = normalizeTrackNumber(entry.song_number);
  const noteLines = Array.isArray(entry.note_lines) ? entry.note_lines : [];
  const notesText = normalizeNotesText(noteLines);

  if (!songName) {
    return {
      status: 'invalid',
      message: 'song_name is required',
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }
  if (!trackNumber) {
    return {
      status: 'invalid',
      message: 'song_number is required for automatic matching',
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }
  if (!notesText) {
    return {
      status: 'invalid',
      message: 'note_lines cannot be empty',
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }
  if (notesText.length > 5000) {
    return {
      status: 'invalid',
      message: 'notes length exceeds 5000 characters',
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }

  const selectedTrackId = Number(resolutions[entry.row_key]);
  if (Number.isInteger(selectedTrackId) && selectedTrackId > 0) {
    const selectedCandidate = await queryTrackCandidateById(selectedTrackId);
    if (selectedCandidate) {
      return {
        status: 'matched',
        matched_track_id: selectedCandidate.track_id,
        candidates: [selectedCandidate],
        trackNumber,
        notesText,
        noteLinesCount: noteLines.length,
      };
    }
  }

  const strictCandidates = await queryStrictTrackMatch(songName, trackNumber);
  if (strictCandidates.length === 1) {
    return {
      status: 'matched',
      matched_track_id: strictCandidates[0].track_id,
      candidates: strictCandidates,
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }

  if (strictCandidates.length > 1) {
    const selected = Number(resolutions[entry.row_key]);
    const selectedCandidate = strictCandidates.find((candidate) => candidate.track_id === selected);
    if (selectedCandidate) {
      return {
        status: 'matched',
        matched_track_id: selectedCandidate.track_id,
        candidates: strictCandidates,
        trackNumber,
        notesText,
        noteLinesCount: noteLines.length,
      };
    }

    return {
      status: 'needs_manual',
      message: 'Multiple strict matches found. Please choose one track manually.',
      candidates: strictCandidates,
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }

  const manualCandidates = await queryManualTrackCandidates(songName, trackNumber);
  if (manualCandidates.length === 0) {
    return {
      status: 'not_found',
      message: 'No track candidates found for this entry',
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }

  const selected = Number(resolutions[entry.row_key]);
  const selectedCandidate = manualCandidates.find((candidate) => candidate.track_id === selected);
  if (selectedCandidate) {
    return {
      status: 'matched',
      matched_track_id: selectedCandidate.track_id,
      candidates: manualCandidates,
      trackNumber,
      notesText,
      noteLinesCount: noteLines.length,
    };
  }

  return {
    status: 'needs_manual',
    message: 'No strict match found. Please select a target track manually.',
    candidates: manualCandidates,
    trackNumber,
    notesText,
    noteLinesCount: noteLines.length,
  };
};

const findTracksByTitle = async (
  db: Queryable,
  title: string
): Promise<Array<{ id: number; title: string; album_id: number | null; album_title: string | null; artists: string[] }>> => {
  const normalizedTitle = title.trim();
  const result = await db.query(
    `
      SELECT
        t.id,
        t.title,
        t.album_id,
        a.title AS album_title,
        COALESCE(
          array_agg(DISTINCT ar.name) FILTER (WHERE ar.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON ta.track_id = t.id
      LEFT JOIN artists ar ON ar.id = ta.artist_id
      WHERE LOWER(TRIM(t.title)) = LOWER(TRIM($1))
      GROUP BY t.id, t.title, t.album_id, a.title
      ORDER BY t.id DESC
    `,
    [normalizedTitle]
  );

  return result.rows;
};

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
    // auto_credits: 优先从 query string 读（绕开 multipart body 字段顺序问题），兼容 body
    const autoCreditsRaw = (req.query.auto_credits as string) ?? req.body.auto_credits;
    const autoCredits = autoCreditsRaw !== 'false';

    // 元数据覆盖字段（前端在步骤2编辑后传入，每个文件对应的覆盖）
    // 格式：title_override_<index>、album_override_<index>
    // 或全局覆盖（单文件上传时）：title_override、album_override
    const getTitleOverride = (idx: number): string | null =>
      req.body[`title_override_${idx}`] || req.body.title_override || null;
    const getAlbumOverride = (idx: number): string | null =>
      req.body[`album_override_${idx}`] || req.body.album_override || null;

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      let fileBuffer: Buffer | null = null;
      try {
        // Read file from disk (Multer disk storage) without blocking event loop.
        fileBuffer = await fs.promises.readFile(file.path);

        // ── Deep file type validation (magic bytes) ──
        if (!isValidFlacBuffer(fileBuffer)) {
          console.warn(`File ${file.originalname} failed FLAC magic byte check`);
          // Clean up temp file
          try { await fs.promises.unlink(file.path); } catch {}
          continue; // skip this file
        }

        // Extract metadata from FLAC file
        // music-metadata v11: second arg must be IFileInfo object or mime string
        const metadata = await parseBuffer(fileBuffer, { mimeType: file.mimetype || 'audio/flac' });

        // 优先使用前端传入的覆盖值，回退到 FLAC 内嵌标签，再回退到默认值
        const titleOverride = getTitleOverride(fileIdx);
        const albumOverride = getAlbumOverride(fileIdx);

        const title = titleOverride || metadata.common.title || path.basename(file.originalname, '.flac');
        const artistNames = metadata.common.artists || (metadata.common.artist ? [metadata.common.artist] : ['Unknown Artist']);
        const albumTitle = albumOverride !== null
          ? (albumOverride || null)
          : (metadata.common.album || null);
        const trackNumber = metadata.common.track.no || null;

        const normalizedAlbumTitle = albumTitle ? albumTitle.trim() : null;

        // Parse release date: prefer full date string from native tags, fallback to year-only
        let releaseDate: Date | null = null;
        // Try metadata.common.date first (full date string like "2022-03-15")
        const commonDate = (metadata.common as any).date;
        if (commonDate && typeof commonDate === 'string') {
          const parsed = new Date(commonDate);
          if (!isNaN(parsed.getTime())) releaseDate = parsed;
        }
        // Try native tags for full date (DATE, TDRC, ORIGINALDATE)
        if (!releaseDate && metadata.native) {
          for (const [, tags] of Object.entries(metadata.native)) {
            for (const tag of tags) {
              const tagId = tag.id.toLowerCase();
              if (tagId === 'date' || tagId === 'tdrc' || tagId === 'originaldate') {
                const val = typeof tag.value === 'string' ? tag.value : '';
                // Accept date strings like "2022-03-15" or "2022-03-15T00:00:00"
                if (val && val.length >= 10) {
                  const parsed = new Date(val);
                  if (!isNaN(parsed.getTime())) { releaseDate = parsed; break; }
                }
              }
            }
            if (releaseDate) break;
          }
        }
        // Fallback to year-only
        if (!releaseDate && metadata.common.year) {
          releaseDate = new Date(metadata.common.year, 0, 1);
        }

        const duration = metadata.format.duration ? Math.floor(metadata.format.duration) : null;
        const sampleRate = metadata.format.sampleRate || null;
        const bitsPerSample = metadata.format.bitsPerSample || null;
        const fileSize = file.size;

        // Upload FLAC file to storage (local or WebDAV based on config)
        const trackUrl = await storageService.uploadFile(
          fileBuffer,
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
                'INSERT INTO albums (title, title_cn, cover_path, release_date) VALUES ($1, $2, $3, $4) RETURNING id',
                [albumTitle, albumTitle, coverUrl, releaseDate]
              );
              albumId = newAlbum.rows[0].id;
            }
          }

          // Insert track (存储WebDAV URL)
          const trackResult = await client.query(
            `INSERT INTO tracks 
            (title, title_cn, album_id, file_path, cover_path, duration, track_number, sample_rate, bit_depth, file_size, release_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
              title,
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

          // ── Credits: 优先使用前端传入的 credits_override，否则自动解析 ──
          const creditsOverrideRaw = req.body[`credits_override_${fileIdx}`];
          if (autoCredits) {
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

          if (creditsOverrideRaw) {
            // 前端已预览并（可能）编辑过 credits，直接使用
            try {
              const overrideList: Array<{ key: string; value: string }> = JSON.parse(creditsOverrideRaw);
              for (const entry of overrideList) {
                if (entry.key && entry.value) await insertCredit(entry.key, entry.value);
              }
            } catch {
              // JSON 解析失败则回退到自动解析
              console.warn(`credits_override_${fileIdx} JSON parse failed, falling back to auto`);
            }
          } else {

          // Walk ALL native tag sources
          if (metadata.native) {
            for (const [, tags] of Object.entries(metadata.native)) {
              for (const tag of tags) {
                const keyLower = tag.id.toLowerCase();
                if (CREDIT_SKIP_KEYS.has(keyLower)) continue;
                const strings = toStringList(tag.value);
                for (const s of strings) await insertCredit(tag.id, s);
              }
            }
          }
          // Walk metadata.common
          const commonObj = metadata.common as unknown as Record<string, unknown>;
          for (const [field, value] of Object.entries(commonObj)) {
            const fieldLower = field.toLowerCase();
            if (CREDIT_SKIP_KEYS.has(fieldLower)) continue;
            const strings = toStringList(value);
            for (const s of strings) await insertCredit(field, s);
          }
          } // end else (auto parse)
          } // end if (autoCredits)

          await client.query('COMMIT');

          uploadedTracks.push({
            id: track.id,
            title: track.title,
            artists: artistNames,
            album: normalizedAlbumTitle,
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
      } finally {
        // Clean up temp file from disk
        try { if (file.path) await fs.promises.unlink(file.path); } catch {}
        fileBuffer = null; // allow GC
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

/**
 * Precheck duplicate tracks by filename-derived title before upload.
 * POST /api/tracks/precheck-duplicates
 */
export const precheckDuplicateTracks = async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ITEMS', message: 'No metadata items provided' },
      });
    }

    const duplicates: Array<{
      index: number;
      file: string;
      title: string;
      album: string | null;
      reason: 'DUPLICATE_IN_DB' | 'DUPLICATE_IN_BATCH';
      existing_tracks?: Array<{ id: number; title: string; album_id: number | null; album_title: string | null; artists: string[] }>;
    }> = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const index = Number.isInteger(item.index) ? item.index : i;
      const file = typeof item.file === 'string' ? item.file : `item_${index}`;
      const titleRaw = typeof item.title === 'string' ? item.title : '';
      const title = titleRaw.trim();
      const album = null;
      if (!title) continue;

      const batchKey = title.toLowerCase();
      if (seenInBatch.has(batchKey)) {
        duplicates.push({ index, file, title, album, reason: 'DUPLICATE_IN_BATCH' });
        continue;
      }
      seenInBatch.add(batchKey);

      const existingTracks = await findTracksByTitle(pool, title);
      if (existingTracks.length > 0) {
        duplicates.push({
          index,
          file,
          title,
          album,
          reason: 'DUPLICATE_IN_DB',
          existing_tracks: existingTracks,
        });
      }
    }

    return res.json({
      success: true,
      data: {
        duplicates,
        duplicate_total: duplicates.length,
      },
    });
  } catch (error) {
    console.error('Precheck duplicates error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'PRECHECK_ERROR', message: 'Failed to precheck duplicates' },
    });
  }
};

export const previewTrackNotesImport = async (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as TrackNotesImportEntry[]) : [];
    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ENTRIES', message: 'No import entries provided' },
      });
    }

    const items: TrackNotesImportItem[] = [];
    for (const entry of entries) {
      const resolution = await resolveTrackForNotesImport(entry, {});
      items.push({
        row_key: entry.row_key,
        song_name: String(entry.song_name || '').trim(),
        song_number_raw: entry.song_number == null ? '' : String(entry.song_number).trim(),
        status: resolution.status,
        message: resolution.message,
        matched_track_id: resolution.matched_track_id,
        note_lines_count: resolution.noteLinesCount,
        candidates: resolution.candidates,
      });
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          matched: items.filter((item) => item.status === 'matched').length,
          needs_manual: items.filter((item) => item.status === 'needs_manual').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Preview track notes import error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'PREVIEW_ERROR', message: 'Failed to preview track notes import' },
    });
  }
};

export const commitTrackNotesImport = async (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as TrackNotesImportEntry[]) : [];
    const resolutions = req.body?.resolutions && typeof req.body.resolutions === 'object'
      ? (req.body.resolutions as Record<string, number>)
      : {};
    const conflictMode = req.body?.conflict_mode === 'append' || req.body?.conflict_mode === 'skip'
      ? req.body.conflict_mode
      : 'overwrite';

    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ENTRIES', message: 'No import entries provided' },
      });
    }

    const items: TrackNotesImportItem[] = [];

    for (const entry of entries) {
      const resolved = await resolveTrackForNotesImport(entry, resolutions);
      const baseItem: TrackNotesImportItem = {
        row_key: entry.row_key,
        song_name: String(entry.song_name || '').trim(),
        song_number_raw: entry.song_number == null ? '' : String(entry.song_number).trim(),
        status: resolved.status,
        message: resolved.message,
        matched_track_id: resolved.matched_track_id,
        note_lines_count: resolved.noteLinesCount,
        candidates: resolved.candidates,
      };

      if (resolved.status === 'invalid' || resolved.status === 'not_found' || resolved.status === 'needs_manual') {
        items.push(baseItem);
        continue;
      }

      if (!resolved.matched_track_id) {
        items.push({ ...baseItem, status: 'error', message: 'Resolved track id is missing' });
        continue;
      }

      try {
        const currentTrackResult = await pool.query(
          'SELECT notes FROM tracks WHERE id = $1',
          [resolved.matched_track_id]
        );

        if (currentTrackResult.rows.length === 0) {
          items.push({ ...baseItem, status: 'error', message: 'Target track not found' });
          continue;
        }

        const currentNotes = String(currentTrackResult.rows[0].notes || '').trim();
        if (conflictMode === 'skip' && currentNotes) {
          items.push({ ...baseItem, status: 'skipped', message: 'Track already has notes, skipped by conflict mode' });
          continue;
        }

        const nextNotes = conflictMode === 'append' && currentNotes
          ? `${currentNotes}\n${resolved.notesText}`
          : resolved.notesText;

        if (nextNotes.length > 5000) {
          items.push({ ...baseItem, status: 'error', message: 'Resulting notes exceed 5000 characters' });
          continue;
        }

        await pool.query(
          'UPDATE tracks SET notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [nextNotes, resolved.matched_track_id]
        );

        items.push({ ...baseItem, status: 'imported', message: 'Notes imported successfully' });
      } catch (error) {
        console.error('Commit track notes import item error:', error);
        items.push({ ...baseItem, status: 'error', message: 'Failed to save notes to database' });
      }
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total: items.length,
          imported: items.filter((item) => item.status === 'imported').length,
          skipped: items.filter((item) => item.status === 'skipped').length,
          needs_manual: items.filter((item) => item.status === 'needs_manual').length,
          not_found: items.filter((item) => item.status === 'not_found').length,
          invalid: items.filter((item) => item.status === 'invalid').length,
          error: items.filter((item) => item.status === 'error').length,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Commit track notes import error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'IMPORT_ERROR', message: 'Failed to import track notes' },
    });
  }
};

export const getTrackNotesImportCandidates = async (req: Request, res: Response) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const requestedLimit = Number.parseInt(String(req.query.limit || '30'), 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_KEYWORD', message: 'keyword is required' },
      });
    }

    const candidates = await searchTrackCandidatesForNotesImport(keyword, limit);
    return res.json({
      success: true,
      data: { candidates },
    });
  } catch (error) {
    console.error('Get track notes import candidates error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CANDIDATE_SEARCH_ERROR', message: 'Failed to search track candidates' },
    });
  }
};

export const exportAllTrackNotes = async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query<ExportTrackNotesRow>(
      `SELECT
         t.id AS track_id,
         a.title AS album_title,
         t.title AS track_title,
         t.track_number,
         t.notes
       FROM tracks t
       LEFT JOIN albums a ON a.id = t.album_id
       WHERE t.notes IS NOT NULL
         AND BTRIM(t.notes) <> ''
       ORDER BY COALESCE(a.title, '') ASC, t.track_number ASC NULLS LAST, t.id ASC`
    );

    const payload = rows.rows.map((row) => {
      const noteLines = String(row.notes || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      return {
        '专辑名': row.album_title || '',
        '歌曲名': row.track_title,
        '歌曲编号': row.track_number != null ? String(row.track_number).padStart(2, '0') : '',
        'soundtrack usage': noteLines.map((location) => ({ location })),
      };
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `track-notes-export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Export track notes error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export track notes' },
    });
  }
};

export const exportCatalogMetadata = async (_req: Request, res: Response) => {
  try {
    const [albumsResult, tracksResult] = await Promise.all([
      pool.query<CatalogAlbumExportRow>(
        `SELECT id, uuid::text AS uuid, title, title_cn, title_en, game_id, release_date, notes
         FROM albums
         ORDER BY id ASC`
      ),
      pool.query<CatalogTrackExportRow>(
        `SELECT
           t.id,
           t.uuid::text AS uuid,
           t.title,
           t.title_cn,
           t.title_en,
           t.album_id,
           a.uuid::text AS album_uuid,
           t.track_number,
           t.release_date,
           t.notes
         FROM tracks t
         LEFT JOIN albums a ON a.id = t.album_id
         ORDER BY t.id ASC`
      ),
    ]);

    const payload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      albums: albumsResult.rows,
      tracks: tracksResult.rows,
      summary: {
        album_count: albumsResult.rows.length,
        track_count: tracksResult.rows.length,
      },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `catalog-metadata-export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Export catalog metadata error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export catalog metadata' },
    });
  }
};

const applyCatalogMetadataByUuid = async (
  req: Request,
  options: { dryRun: boolean; createAuditBatch: boolean }
) => {
  const albums = Array.isArray(req.body?.albums) ? req.body.albums : [];
  const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks : [];
  const syncLegacyTitle = req.body?.sync_legacy_title === true;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const items: CatalogMetadataImportItemResult[] = [];
    const batchUuid = options.createAuditBatch ? randomUUID() : null;
    const currentUser = req.user as { id?: number; username?: string } | undefined;
    const albumsNotFound: string[] = [];
    const tracksNotFound: string[] = [];
    let albumsUpdated = 0;
    let tracksUpdated = 0;

    if (options.createAuditBatch && batchUuid) {
      await client.query(
        `INSERT INTO catalog_metadata_import_batches (
           batch_uuid, requested_by_user_id, requested_by_username, sync_legacy_title,
           albums_input, tracks_input, status
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'committed')`,
        [batchUuid, currentUser?.id ?? null, currentUser?.username ?? null, syncLegacyTitle, albums.length, tracks.length]
      );
    }

    for (const album of albums) {
      const beforeResult = await client.query(
        'SELECT id, title, title_cn, title_en FROM albums WHERE uuid = $1::uuid',
        [album.uuid]
      );
      if (beforeResult.rows.length === 0) {
        albumsNotFound.push(String(album.uuid));
        items.push({ entity_type: 'album', uuid: String(album.uuid), status: 'not_found' });
        continue;
      }

      const beforeRow = beforeResult.rows[0];
      const nextTitle = syncLegacyTitle && album.title !== undefined ? album.title : beforeRow.title;
      const nextTitleCn = album.title_cn !== undefined ? album.title_cn : beforeRow.title_cn;
      const nextTitleEn = album.title_en !== undefined ? album.title_en : beforeRow.title_en;

      if (nextTitle === beforeRow.title && nextTitleCn === beforeRow.title_cn && nextTitleEn === beforeRow.title_en) {
        items.push({ entity_type: 'album', uuid: String(album.uuid), status: 'skipped', entity_id: Number(beforeRow.id), reason: 'No changes detected' });
        continue;
      }

      if (!options.dryRun) {
        await client.query(
          'UPDATE albums SET title = $2, title_cn = $3, title_en = $4, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1::uuid',
          [album.uuid, nextTitle, nextTitleCn, nextTitleEn]
        );
      }

      if (options.createAuditBatch && batchUuid) {
        await client.query(
          `INSERT INTO catalog_metadata_import_changes (
             batch_uuid, entity_type, entity_uuid, entity_id,
             before_title, before_title_cn, before_title_en,
             after_title, after_title_cn, after_title_en
           ) VALUES ($1::uuid, 'album', $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
          [batchUuid, album.uuid, Number(beforeRow.id), beforeRow.title, beforeRow.title_cn, beforeRow.title_en, nextTitle, nextTitleCn, nextTitleEn]
        );
      }

      items.push({ entity_type: 'album', uuid: String(album.uuid), status: 'updated', entity_id: Number(beforeRow.id) });
      albumsUpdated += 1;
    }

    for (const track of tracks) {
      const beforeResult = await client.query(
        'SELECT id, title, title_cn, title_en FROM tracks WHERE uuid = $1::uuid',
        [track.uuid]
      );
      if (beforeResult.rows.length === 0) {
        tracksNotFound.push(String(track.uuid));
        items.push({ entity_type: 'track', uuid: String(track.uuid), status: 'not_found' });
        continue;
      }

      const beforeRow = beforeResult.rows[0];
      const nextTitle = syncLegacyTitle && track.title !== undefined ? track.title : beforeRow.title;
      const nextTitleCn = track.title_cn !== undefined ? track.title_cn : beforeRow.title_cn;
      const nextTitleEn = track.title_en !== undefined ? track.title_en : beforeRow.title_en;

      if (nextTitle === beforeRow.title && nextTitleCn === beforeRow.title_cn && nextTitleEn === beforeRow.title_en) {
        items.push({ entity_type: 'track', uuid: String(track.uuid), status: 'skipped', entity_id: Number(beforeRow.id), reason: 'No changes detected' });
        continue;
      }

      if (!options.dryRun) {
        await client.query(
          'UPDATE tracks SET title = $2, title_cn = $3, title_en = $4, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1::uuid',
          [track.uuid, nextTitle, nextTitleCn, nextTitleEn]
        );
      }

      if (options.createAuditBatch && batchUuid) {
        await client.query(
          `INSERT INTO catalog_metadata_import_changes (
             batch_uuid, entity_type, entity_uuid, entity_id,
             before_title, before_title_cn, before_title_en,
             after_title, after_title_cn, after_title_en
           ) VALUES ($1::uuid, 'track', $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
          [batchUuid, track.uuid, Number(beforeRow.id), beforeRow.title, beforeRow.title_cn, beforeRow.title_en, nextTitle, nextTitleCn, nextTitleEn]
        );
      }

      items.push({ entity_type: 'track', uuid: String(track.uuid), status: 'updated', entity_id: Number(beforeRow.id) });
      tracksUpdated += 1;
    }

    if (options.createAuditBatch && batchUuid) {
      await client.query(
        `UPDATE catalog_metadata_import_batches
         SET albums_updated = $2, tracks_updated = $3, albums_not_found = $4, tracks_not_found = $5
         WHERE batch_uuid = $1::uuid`,
        [batchUuid, albumsUpdated, tracksUpdated, albumsNotFound.length, tracksNotFound.length]
      );
    }

    if (options.dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    return {
      summary: {
        albums_input: albums.length,
        tracks_input: tracks.length,
        albums_updated: albumsUpdated,
        tracks_updated: tracksUpdated,
        albums_not_found: albumsNotFound.length,
        tracks_not_found: tracksNotFound.length,
        skipped: items.filter((item) => item.status === 'skipped').length,
      },
      albums_not_found_uuids: albumsNotFound,
      tracks_not_found_uuids: tracksNotFound,
      items,
      batch_uuid: batchUuid,
      dry_run: options.dryRun,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
};

export const previewCatalogMetadataByUuid = async (req: Request, res: Response) => {
  try {
    const result = await applyCatalogMetadataByUuid(req, { dryRun: true, createAuditBatch: false });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Preview catalog metadata by uuid error:', error);
    return res.status(500).json({ success: false, error: { code: 'PREVIEW_ERROR', message: 'Failed to preview catalog metadata by uuid' } });
  }
};

export const commitCatalogMetadataByUuid = async (req: Request, res: Response) => {
  try {
    const result = await applyCatalogMetadataByUuid(req, { dryRun: false, createAuditBatch: true });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Commit catalog metadata by uuid error:', error);
    return res.status(500).json({ success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to commit catalog metadata by uuid' } });
  }
};

export const rollbackCatalogMetadataImportBatch = async (req: Request, res: Response) => {
  try {
    const batchUuid = String(req.body?.batch_uuid || '').trim();
    if (!batchUuid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'batch_uuid is required' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const batchResult = await client.query(
        'SELECT status FROM catalog_metadata_import_batches WHERE batch_uuid = $1::uuid',
        [batchUuid]
      );
      if (batchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } });
      }
      if (batchResult.rows[0].status === 'rolled_back') {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: { code: 'ALREADY_ROLLED_BACK', message: 'Batch already rolled back' } });
      }

      const changesResult = await client.query(
        `SELECT entity_type, entity_uuid::text AS entity_uuid, before_title, before_title_cn, before_title_en
         FROM catalog_metadata_import_changes
         WHERE batch_uuid = $1::uuid
         ORDER BY id DESC`,
        [batchUuid]
      );

      let albumsReverted = 0;
      let tracksReverted = 0;
      for (const row of changesResult.rows) {
        if (row.entity_type === 'album') {
          const reverted = await client.query(
            'UPDATE albums SET title = $2, title_cn = $3, title_en = $4, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1::uuid RETURNING id',
            [row.entity_uuid, row.before_title, row.before_title_cn, row.before_title_en]
          );
          if (reverted.rows.length > 0) albumsReverted += 1;
        }
        if (row.entity_type === 'track') {
          const reverted = await client.query(
            'UPDATE tracks SET title = $2, title_cn = $3, title_en = $4, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1::uuid RETURNING id',
            [row.entity_uuid, row.before_title, row.before_title_cn, row.before_title_en]
          );
          if (reverted.rows.length > 0) tracksReverted += 1;
        }
      }

      await client.query(
        `UPDATE catalog_metadata_import_batches
         SET status = 'rolled_back', rolled_back_at = NOW()
         WHERE batch_uuid = $1::uuid`,
        [batchUuid]
      );

      await client.query('COMMIT');
      return res.json({ success: true, data: { batch_uuid: batchUuid, albums_reverted: albumsReverted, tracks_reverted: tracksReverted } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Rollback catalog metadata batch error:', error);
    return res.status(500).json({ success: false, error: { code: 'ROLLBACK_ERROR', message: 'Failed to rollback catalog metadata batch' } });
  }
};

export const replaceCatalogMetadataByUuid = async (req: Request, res: Response) => {
  try {
    const result = await applyCatalogMetadataByUuid(req, { dryRun: false, createAuditBatch: true });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Replace catalog metadata by uuid error:', error);
    return res.status(500).json({ success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to import catalog metadata by uuid' } });
  }
};

// Scan duplicates where tracks share the same album and title.
export const scanSameAlbumDuplicateTracks = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        t.album_id,
        COALESCE(a.title, '未分类专辑') AS album_title,
        LOWER(TRIM(t.title)) AS normalized_title,
        MIN(t.title) AS display_title,
        COUNT(*)::int AS duplicate_count,
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'album_id', t.album_id,
            'album_title', COALESCE(a.title, '未分类专辑'),
            'artists', COALESCE(artists.names, ARRAY[]::text[])
          )
          ORDER BY t.id ASC
        ) AS tracks
      FROM tracks t
      LEFT JOIN albums a ON a.id = t.album_id
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT ar.name ORDER BY ar.name) AS names
        FROM track_artists ta
        JOIN artists ar ON ar.id = ta.artist_id
        WHERE ta.track_id = t.id
      ) artists ON TRUE
      GROUP BY t.album_id, COALESCE(a.title, '未分类专辑'), LOWER(TRIM(t.title))
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, album_title ASC, display_title ASC
    `);

    res.json({
      success: true,
      data: {
        groups: result.rows,
        total_groups: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Scan duplicate tracks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DUPLICATE_SCAN_ERROR', message: 'Failed to scan duplicate tracks' },
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

    // game_ids: 逗号分隔的 game id 列表
    const gameIdsRaw = req.query.game_ids as string || '';
    const gameIds = gameIdsRaw
      ? gameIdsRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [];
    // artist: 保留历史参数名，实际按自定义 credit_value 进行模糊匹配
    const artistFilter = (req.query.artist as string || '').trim();
    const titleExact = (req.query.title_exact as string || '').trim();
    const albumExact = (req.query.album_exact as string || '').trim();
    const durationBucketRaw = (req.query.duration_bucket as string || '').trim().toLowerCase();
    const durationBucket = durationBucketRaw === 'short' || durationBucketRaw === 'medium' || durationBucketRaw === 'long'
      ? durationBucketRaw
      : null;
    const hasLyricsRaw = (req.query.has_lyrics as string || '').trim().toLowerCase();
    const hasLyrics = hasLyricsRaw === 'true' ? true : hasLyricsRaw === 'false' ? false : null;
    const lyricsStatusRaw = (req.query.lyrics_status as string || '').trim().toLowerCase();
    const lyricsStatus = lyricsStatusRaw === 'none' || lyricsStatusRaw === 'has' || lyricsStatusRaw === 'instrumental'
      ? lyricsStatusRaw
      : null;

    const sortBy  = (req.query.sort_by as string) || 'release_date';
    const sortDir = (req.query.sort_dir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const allowedSort: Record<string, string> = {
      created_at:   't.created_at',
      title:        't.title',
      duration:     't.duration',
      sample_rate:  't.sample_rate',
      release_date: 'COALESCE(t.release_date, a.release_date)',
    };
    const orderBy = allowedSort[sortBy] || 'COALESCE(t.release_date, a.release_date)';

    // Build WHERE clauses
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(
        LOWER(t.title) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(t.title_cn, '')) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(t.title_en, '')) LIKE LOWER($${pIdx})
        OR LOWER(a.title) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(a.title_cn, '')) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(a.title_en, '')) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(t.notes, '')) LIKE LOWER($${pIdx})
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
    if (titleExact) {
      conditions.push(`t.title = $${pIdx++}`);
      queryParams.push(titleExact);
    }
    if (albumExact) {
      conditions.push(`COALESCE(a.title, '') = $${pIdx++}`);
      queryParams.push(albumExact);
    }
    if (durationBucket === 'short') {
      conditions.push(`t.duration > 0 AND t.duration < 180`);
    }
    if (durationBucket === 'medium') {
      conditions.push(`t.duration >= 180 AND t.duration <= 300`);
    }
    if (durationBucket === 'long') {
      conditions.push(`t.duration > 300`);
    }
    if (lyricsStatus) {
      conditions.push(`COALESCE(NULLIF(BTRIM(t.lyrics_status), ''), CASE WHEN t.lyrics_path IS NOT NULL AND BTRIM(t.lyrics_path) <> '' THEN 'has' ELSE 'none' END) = $${pIdx++}`);
      queryParams.push(lyricsStatus);
    } else if (hasLyrics === true) {
      conditions.push(`t.lyrics_path IS NOT NULL AND BTRIM(t.lyrics_path) <> ''`);
    } else if (hasLyrics === false) {
      conditions.push(`(t.lyrics_path IS NULL OR BTRIM(t.lyrics_path) = '')`);
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

    // 游戏筛选
    if (gameIds.length > 0) {
      conditions.push(`a.game_id = ANY($${pIdx++})`);
      queryParams.push(gameIds);
    }

    // 制作人员/Credit 筛选（兼容历史 artist 参数）
    if (artistFilter) {
      conditions.push(`EXISTS (
        SELECT 1 FROM track_credits tc_af
        WHERE tc_af.track_id = t.id
        AND LOWER(tc_af.credit_value) LIKE LOWER($${pIdx++})
      )`);
      queryParams.push(`%${artistFilter}%`);
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
        a.uuid as album_uuid,
        a.title as album_title,
        a.title_cn as album_title_cn,
        a.title_en as album_title_en,
        a.cover_path as album_cover,
        a.release_date as album_release_date,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists,
        COUNT(DISTINCT fav.user_id)::int AS favorite_count
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      LEFT JOIN favorites fav ON t.id = fav.track_id
      ${whereClause}
      GROUP BY t.id, a.id, a.uuid, a.title, a.title_cn, a.title_en, a.cover_path, a.release_date, a.created_at
      ORDER BY ${orderBy} ${sortDir}, COALESCE(a.release_date, a.created_at) ${sortDir}, t.track_number ASC NULLS LAST, t.title ASC
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

export const getTrackFilterOptions = async (_req: Request, res: Response) => {
  try {
    const [titleResult, albumResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT BTRIM(t.title) AS value
         FROM tracks t
         WHERE t.title IS NOT NULL AND BTRIM(t.title) <> ''
         ORDER BY value ASC`
      ),
      pool.query(
        `SELECT DISTINCT BTRIM(a.title) AS value
         FROM tracks t
         JOIN albums a ON t.album_id = a.id
         WHERE a.title IS NOT NULL AND BTRIM(a.title) <> ''
         ORDER BY value ASC`
      ),
    ]);

    res.json({
      success: true,
      data: {
        titles: titleResult.rows.map((row) => String(row.value)),
        albums: albumResult.rows.map((row) => String(row.value)),
      },
    });
  } catch (error) {
    console.error('Get track filter options error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch track filter options' },
    });
  }
};

export const getTrackById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const trackResult = await pool.query(
      `SELECT 
        t.*,
        a.uuid as album_uuid,
        a.title as album_title,
        a.title_cn as album_title_cn,
        a.title_en as album_title_en,
        a.cover_path as album_cover,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists,
        COUNT(DISTINCT fav.user_id)::int AS favorite_count
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      LEFT JOIN favorites fav ON t.id = fav.track_id
      WHERE t.id = $1
      GROUP BY t.id, a.id, a.uuid, a.title, a.title_cn, a.title_en, a.cover_path`,
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
    } else if (storageService.isOSS()) {
      // OSS 模式：服务器中转，用签名 URL 拉流后转发给客户端（解决私有 bucket 403，同时节省 OSS 外网流量费）
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(filePath, 300); // 5 分钟有效
      const range = req.headers.range;
      const requestHeaders: Record<string, string> = {};
      if (range) requestHeaders['Range'] = range;

      const ossRequest = (signedUrl.startsWith('https') ? https : http).get(
        signedUrl,
        { headers: requestHeaders },
        (ossRes) => {
          const statusCode = ossRes.statusCode || 200;
          // 透传关键响应头
          const forwardHeaders: Record<string, string | string[]> = {
            'Content-Type': (ossRes.headers['content-type'] as string) || 'audio/flac',
            'Accept-Ranges': 'bytes',
          };
          if (ossRes.headers['content-length']) {
            forwardHeaders['Content-Length'] = ossRes.headers['content-length'] as string;
          }
          if (ossRes.headers['content-range']) {
            forwardHeaders['Content-Range'] = ossRes.headers['content-range'] as string;
          }
          res.writeHead(statusCode, forwardHeaders);
          ossRes.pipe(res);
        }
      );
      ossRequest.on('error', (err) => {
        console.error('OSS proxy stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: { code: 'STREAM_ERROR', message: 'Failed to proxy stream from OSS' } });
        }
      });
      return;
    } else {
      // 本地存储模式：流式传输文件
      const fullPath = storageService.getFullPath(filePath);

      let fileSize = 0;
      try {
        const stat = await fs.promises.stat(fullPath);
        fileSize = stat.size;
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          return res.status(404).json({
            success: false,
            error: { code: 'FILE_NOT_FOUND', message: 'File not found' }
          });
        }
        throw error;
      }

      const range = req.headers.range;

      if (range) {
        // 支持Range请求（用于播放器seek功能）
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= fileSize) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).json({
            success: false,
            error: { code: 'INVALID_RANGE', message: 'Requested range not satisfiable' }
          });
        }
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
    } else if (storageService.isOSS()) {
      // OSS 模式：服务器中转下载，用签名 URL 拉流
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(file_path, 300);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.flac"`);
      const ossRequest = (signedUrl.startsWith('https') ? https : http).get(signedUrl, (ossRes) => {
        const forwardHeaders: Record<string, string> = {
          'Content-Type': (ossRes.headers['content-type'] as string) || 'audio/flac',
        };
        if (ossRes.headers['content-length']) {
          forwardHeaders['Content-Length'] = ossRes.headers['content-length'] as string;
        }
        res.writeHead(ossRes.statusCode || 200, forwardHeaders);
        ossRes.pipe(res);
      });
      ossRequest.on('error', (err) => {
        console.error('OSS proxy download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message: 'Failed to proxy download from OSS' } });
        }
      });
      return;
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
    const { title, title_cn, title_en, artists, album_title, release_date, track_number, notes } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update track title and optional fields
      await client.query(
        `UPDATE tracks SET 
          title = $1, 
          title_cn = COALESCE($2, title_cn),
          title_en = COALESCE($3, title_en),
          release_date = COALESCE($4, release_date),
          track_number = COALESCE($5, track_number),
          notes = $6,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = $7`,
        [
          title,
          title_cn !== undefined ? title_cn : null,
          title_en !== undefined ? title_en : null,
          release_date || null,
          track_number || null,
          notes !== undefined ? notes : null,
          id,
        ]
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
            'INSERT INTO albums (title, title_cn) VALUES ($1, $2) RETURNING id',
            [album_title, album_title]
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

export const clearTrackNotes = async (req: Request, res: Response) => {
  try {
    const trackId = Number(req.params.id);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRACK_ID', message: 'Invalid track id' },
      });
    }

    const result = await pool.query(
      'UPDATE tracks SET notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [trackId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' },
      });
    }

    return res.json({
      success: true,
      data: { track_id: trackId, cleared: true },
    });
  } catch (error) {
    console.error('Clear track notes error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CLEAR_NOTES_ERROR', message: 'Failed to clear track notes' },
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

// Bulk delete tracks
export const bulkDeleteTracks = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供要删除的曲目ID列表' }
      });
    }

    // Get file paths before deletion
    const trackResult = await pool.query(
      'SELECT id, file_path, cover_path FROM tracks WHERE id = ANY($1)',
      [ids]
    );

    // Delete from database (cascade handles track_artists, track_tags, etc.)
    await pool.query('DELETE FROM tracks WHERE id = ANY($1)', [ids]);

    // Delete files from storage
    for (const row of trackResult.rows) {
      try {
        if (row.file_path) await storageService.deleteFile(row.file_path);
        if (row.cover_path) await storageService.deleteFile(row.cover_path);
      } catch (fileError) {
        console.error('Error deleting file from storage:', fileError);
      }
    }

    res.json({
      success: true,
      data: { deleted: trackResult.rows.length, message: `成功删除 ${trackResult.rows.length} 首曲目` }
    });
  } catch (error) {
    console.error('Bulk delete tracks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: '批量删除失败' }
    });
  }
};

// Bulk move tracks to album
export const bulkMoveTracksToAlbum = async (req: Request, res: Response) => {
  try {
    const { trackIds, albumId } = req.body;
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供要移动的曲目ID列表' }
      });
    }

    await pool.query(
      'UPDATE tracks SET album_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)',
      [albumId || null, trackIds]
    );

    res.json({
      success: true,
      data: { moved: trackIds.length, message: `成功移动 ${trackIds.length} 首曲目` }
    });
  } catch (error) {
    console.error('Bulk move tracks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: '批量移动失败' }
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

/**
 * Preview credits that would be extracted from uploaded FLAC files,
 * without writing anything to the database.
 * POST /api/tracks/preview-credits
 */
export const previewCredits = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'No files uploaded' } });
    }

    // Reuse the shared toStringList helper from utils/metadata

    const results = [];
    for (const file of files) {
      let buffer: Buffer | null = null;
      try {
      buffer = await fs.promises.readFile(file.path);

      // Validate file type magic bytes
      if (!isValidFlacBuffer(buffer)) {
        results.push({ filename: file.originalname, credits: [], error: 'Not a valid FLAC file' });
        continue;
      }

      const metadata = await parseBuffer(buffer, { mimeType: file.mimetype || 'audio/flac' });
      const credits: Array<{ key: string; value: string }> = [];
      const seen = new Set<string>();

      const addCredit = (key: string, val: unknown) => {
        const keyLower = key.toLowerCase();
        if (CREDIT_SKIP_KEYS.has(keyLower)) return;
        for (const s of toStringList(val)) {
          const pair = `${keyLower}|${s}`;
          if (seen.has(pair)) continue;
          seen.add(pair);
          credits.push({ key, value: s });
        }
      };

      // Walk native tags
      if (metadata.native) {
        for (const [, tags] of Object.entries(metadata.native)) {
          for (const tag of tags) addCredit(tag.id, tag.value);
        }
      }
      // Walk common fields
      const commonObj = metadata.common as unknown as Record<string, unknown>;
      for (const [field, value] of Object.entries(commonObj)) addCredit(field, value);

      results.push({
        filename: file.originalname,
        credits,
      });
      } finally {
        // Clean up temp file
        try { if (file.path) await fs.promises.unlink(file.path); } catch {}
        buffer = null;
      }
    }

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('Preview credits error:', error);
    return res.status(500).json({ success: false, error: { code: 'PREVIEW_ERROR', message: 'Failed to preview credits' } });
  }
};
