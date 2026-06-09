import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import passport from './config/passport';
import { cache } from './utils/cache';
import pool from './config/database';
import { swaggerSpec } from './config/swagger';
import { initWebDAVDirectories, testWebDAVConnection } from './config/webdav';
import { testOSSConnection, initOSSDirectories } from './config/oss';
import authRoutes from './routes/authRoutes';
import trackRoutes from './routes/trackRoutes';
import publicRoutes from './routes/publicRoutes';
import lyricsRoutes from './routes/lyricsRoutes';
import creditsRoutes from './routes/creditsRoutes';
import albumRoutes from './routes/albumRoutes';
import artistRoutes from './routes/artistRoutes';
import gameRoutes from './routes/gameRoutes';
import tagRoutes from './routes/tagRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import playlistRoutes from './routes/playlistRoutes';
import favoriteRoutes from './routes/favoriteRoutes';
import discRoutes from './routes/discRoutes';
import debugRoutes from './routes/debugRoutes';
import settingsRoutes from './routes/settingsRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes';
import musicSourceRoutes from './routes/musicSourceRoutes';
import { flushVisitLoggerNow, visitLogger } from './middleware/visitLogger';
import { maintenanceModeGuard } from './middleware/maintenanceMode';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG_API_ENABLED = process.env.DEBUG_API_ENABLED === 'true';

app.disable('x-powered-by');

// Remote deployments usually sit behind reverse proxies (Nginx/1Panel).
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === 'true') {
  app.set('trust proxy', true);
} else if (trustProxy === 'false') {
  app.set('trust proxy', false);
} else if (trustProxy && !Number.isNaN(Number(trustProxy))) {
  app.set('trust proxy', Number(trustProxy));
} else {
  app.set('trust proxy', 1);
}

// ── Security Middleware ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Managed by Nginx in production
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// ── ETag ────────────────────────────────────────────────────────
app.set('etag', 'weak'); // Enable weak ETags for all JSON responses

// ── Request Logger ──────────────────────────────────────────────
import { requestLogger } from './middleware/requestLogger';
app.use(requestLogger);

// ── Response Compression ────────────────────────────────────────
app.use(compression({
  filter: (req, res) => {
    // Don't compress audio streams
    if (req.path.includes('/stream')) return false;
    return compression.filter(req, res);
  },
}));

// ── Rate Limiting ───────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,                  // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later.' } },
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                    // 10 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts, please try again later.' } },
});
app.use('/api/auth/login', authLimiter);

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many registration requests, please try again later.' } },
});
app.use('/api/auth/register', registerLimiter);

const verificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many verification requests, please try again later.' } },
});
app.use('/api/auth/send-verification-code', verificationLimiter);

const debugLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many debug requests, please try again later.' } },
});

// ── CORS Configuration ──────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGINS;
app.use(cors(corsOrigins ? {
  origin: corsOrigins.split(',').map(s => s.trim()).filter(Boolean),
  credentials: true,
} : undefined)); // undefined = allow all (dev mode)

// ── Request Timeout ─────────────────────────────────────────────
const parsedRequestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || '60000');
const REQUEST_TIMEOUT = Number.isFinite(parsedRequestTimeout)
  ? Math.min(120000, Math.max(5000, parsedRequestTimeout))
  : 60000;
app.use((req, res, next) => {
  // Skip timeout for audio streaming and large uploads
  if (req.path.includes('/stream') || req.path.includes('/upload') || req.method === 'OPTIONS') {
    return next();
  }
  res.setTimeout(REQUEST_TIMEOUT, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
      });
    }
  });
  next();
});

// ── Core Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(passport.initialize());

// Visit logger — records every request for analytics (before routes)
app.use(visitLogger);

// Maintenance mode gate (logged-in admins are exempted in middleware)
app.use('/api', maintenanceModeGuard);

// 本地存储模式下，提供静态文件访问（远程存储模式下文件直接从远程 URL 获取）
const STATIC_STORAGE_MODE = process.env.STORAGE_MODE || 'local';
if (STATIC_STORAGE_MODE === 'local') {
  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.use('/uploads', express.static(uploadDir, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return;
      }
      if (['.flac', '.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    },
  }));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracks', trackRoutes); // Admin routes (需要认证)
app.use('/api/lyrics', lyricsRoutes); // Lyrics routes
app.use('/api/credits', creditsRoutes); // Credits routes
app.use('/api/albums', albumRoutes); // Album routes
app.use('/api/artists', artistRoutes); // Artist routes
app.use('/api/games', gameRoutes); // Game routes
app.use('/api/tags', tagRoutes);         // Tag routes
app.use('/api/playlists', playlistRoutes); // Playlist routes (authenticated)
app.use('/api/favorites', favoriteRoutes); // Favorites routes (authenticated)
app.use('/api', discRoutes);               // Disc subdivision routes
app.use('/api/analytics', analyticsRoutes); // Analytics (authenticated)
app.use('/api/public', publicRoutes);    // Public routes (无需认证)
app.use('/api', settingsRoutes);          // Site settings (public + authenticated)
if (DEBUG_API_ENABLED) {
  app.use('/api/debug', debugLimiter, debugRoutes); // High-risk debug routes (disabled by default)
} else {
  app.use('/api/debug', (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'DEBUG_DISABLED', message: 'Debug API is disabled' },
    });
  });
}
app.use('/api/users', userRoutes);       // User management (authenticated)
app.use('/api/messages', messageRoutes); // Site messages (authenticated)
app.use('/api/music-sources', musicSourceRoutes); // Music source module (authenticated)

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'HoYoMusic API Docs' }));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// Health check (with database connectivity test)
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1 AS ok');
    const dbOk = dbResult.rows.length > 0;
    res.json({
      success: true,
      message: 'HoYoMusic API is running',
      database: dbOk ? 'connected' : 'error',
      cache: cache.stats(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'HoYoMusic API is running but database is unreachable',
      database: 'disconnected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handler (should be last)
app.use(errorHandler);

// Initialize storage and start server
// ── Migrations (one-shot, to be removed after server deployment) ──
const runMigrations = async () => {
  // 1. artist_aliases + artist_role_aliases
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_aliases (
        id SERIAL PRIMARY KEY,
        canonical_name VARCHAR(500) NOT NULL,
        alias_name VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(canonical_name, alias_name)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_artist_aliases_alias ON artist_aliases (LOWER(alias_name))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_artist_aliases_canonical ON artist_aliases (LOWER(canonical_name))`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_role_aliases (
        id SERIAL PRIMARY KEY,
        canonical_role VARCHAR(200) NOT NULL,
        alias_role VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(canonical_role, alias_role)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_artist_role_aliases_alias ON artist_role_aliases (LOWER(alias_role))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_artist_role_aliases_canonical ON artist_role_aliases (LOWER(canonical_role))`);
  } catch (e) { console.error('migration artist_aliases:', e); }

  // 2. visit_logs
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visit_logs (
        id          BIGSERIAL PRIMARY KEY,
        ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip          VARCHAR(64),
        country     VARCHAR(4),
        region      VARCHAR(128),
        city        VARCHAR(128),
        latitude    NUMERIC(9,6),
        longitude   NUMERIC(9,6),
        method      VARCHAR(10),
        path        VARCHAR(1024),
        status      SMALLINT,
        duration_ms INTEGER,
        user_agent  TEXT,
        ua_browser  VARCHAR(128),
        ua_os       VARCHAR(128),
        ua_device   VARCHAR(64),
        referer     VARCHAR(1024),
        bytes_sent  INTEGER
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_ts      ON visit_logs (ts DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_country ON visit_logs (country)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_path    ON visit_logs (path text_pattern_ops)`);
    await pool.query(`ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(128)`);
    await pool.query(`ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS actor_user_id INTEGER`);
    await pool.query(`ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS actor_username VARCHAR(128)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_visitor_id ON visit_logs (visitor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_actor_user_id ON visit_logs (actor_user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_visit_logs_actor_username ON visit_logs (actor_username)`);
    await pool.query(`UPDATE visit_logs SET visitor_id = NULL WHERE visitor_id IS NOT NULL AND TRIM(visitor_id) = ''`);
  } catch (e) { console.error('migration visit_logs:', e); }

  // 3. playlists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        cover_path VARCHAR(500),
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
        track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (playlist_id, track_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)`);
    await pool.query(`UPDATE playlists SET is_public = FALSE WHERE is_public = TRUE`);
  } catch (e) { console.error('migration playlists:', e); }

  // 4. favorites
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, track_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)`);
  } catch (e) { console.error('migration favorites:', e); }

  // 5. site_messages
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_message_deliveries (
        id BIGSERIAL PRIMARY KEY,
        message_id BIGINT NOT NULL REFERENCES site_messages(id) ON DELETE CASCADE,
        recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        UNIQUE(message_id, recipient_user_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_site_message_deliveries_user ON site_message_deliveries(recipient_user_id, delivered_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_site_message_deliveries_unread ON site_message_deliveries(recipient_user_id, is_read)`);
  } catch (e) { console.error('migration site_messages:', e); }

  // 6. tracks: sha256_hash, play_count
  try {
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64)`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(sha256_hash) WHERE sha256_hash IS NOT NULL`);
  } catch (e) { console.error('migration tracks_hash_playcount:', e); }

  // 7. track_play_events
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS track_play_events (
        id BIGSERIAL PRIMARY KEY,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
        track_duration_seconds NUMERIC(10,2),
        min_required_seconds NUMERIC(10,2) NOT NULL,
        effective_play BOOLEAN NOT NULL DEFAULT FALSE,
        source_ip VARCHAR(64),
        user_agent TEXT,
        session_key VARCHAR(128) NOT NULL,
        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(track_id, session_key)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_play_events_played_at ON track_play_events (played_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_play_events_track_effective ON track_play_events (track_id, effective_play, played_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_play_events_source_ip ON track_play_events (source_ip)`);
  } catch (e) { console.error('migration track_play_events:', e); }

  // 8. albums/tracks: notes
  try {
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS notes TEXT`);
  } catch (e) { console.error('migration albums_tracks_notes:', e); }

  // 9. albums/tracks: uuid, title_cn, title_en
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS uuid UUID`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS uuid UUID`);
    await pool.query(`ALTER TABLE albums ALTER COLUMN uuid SET DEFAULT gen_random_uuid()`);
    await pool.query(`ALTER TABLE tracks ALTER COLUMN uuid SET DEFAULT gen_random_uuid()`);
    await pool.query(`UPDATE albums SET uuid = gen_random_uuid() WHERE uuid IS NULL`);
    await pool.query(`UPDATE tracks SET uuid = gen_random_uuid() WHERE uuid IS NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_uuid ON albums(uuid)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_uuid ON tracks(uuid)`);
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS title_cn VARCHAR(500)`);
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS title_en VARCHAR(500)`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS title_cn VARCHAR(500)`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS title_en VARCHAR(500)`);
    await pool.query(`UPDATE albums SET title_cn = title WHERE title_cn IS NULL AND title IS NOT NULL`);
    await pool.query(`UPDATE tracks SET title_cn = title WHERE title_cn IS NULL AND title IS NOT NULL`);
  } catch (e) { console.error('migration catalog_metadata:', e); }

  // 10. catalog_metadata_import_audit
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_metadata_import_batches (
        id BIGSERIAL PRIMARY KEY,
        batch_uuid UUID NOT NULL UNIQUE,
        requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        requested_by_username VARCHAR(100),
        sync_legacy_title BOOLEAN NOT NULL DEFAULT FALSE,
        albums_input INTEGER NOT NULL DEFAULT 0,
        tracks_input INTEGER NOT NULL DEFAULT 0,
        albums_updated INTEGER NOT NULL DEFAULT 0,
        tracks_updated INTEGER NOT NULL DEFAULT 0,
        albums_not_found INTEGER NOT NULL DEFAULT 0,
        tracks_not_found INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'committed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        rolled_back_at TIMESTAMPTZ
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_metadata_import_changes (
        id BIGSERIAL PRIMARY KEY,
        batch_uuid UUID NOT NULL REFERENCES catalog_metadata_import_batches(batch_uuid) ON DELETE CASCADE,
        entity_type VARCHAR(10) NOT NULL,
        entity_uuid UUID NOT NULL,
        entity_id INTEGER,
        before_title VARCHAR(500),
        before_title_cn VARCHAR(500),
        before_title_en VARCHAR(500),
        after_title VARCHAR(500),
        after_title_cn VARCHAR(500),
        after_title_en VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_metadata_batches_created_at ON catalog_metadata_import_batches(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_metadata_batches_status ON catalog_metadata_import_batches(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_metadata_changes_batch_uuid ON catalog_metadata_import_changes(batch_uuid)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_metadata_changes_entity_uuid ON catalog_metadata_import_changes(entity_uuid)`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_catalog_metadata_import_batch_status') THEN
          ALTER TABLE catalog_metadata_import_batches
          ADD CONSTRAINT chk_catalog_metadata_import_batch_status CHECK (status IN ('committed', 'rolled_back'));
        END IF;
      END $$
    `);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_catalog_metadata_import_change_entity_type') THEN
          ALTER TABLE catalog_metadata_import_changes
          ADD CONSTRAINT chk_catalog_metadata_import_change_entity_type CHECK (entity_type IN ('album', 'track'));
        END IF;
      END $$
    `);
  } catch (e) { console.error('migration catalog_metadata_import_audit:', e); }

  // 11. music source module
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS music_source_categories (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, name)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS music_source_nodes (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid(),
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES music_source_categories(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES music_source_nodes(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, category_id, parent_id, name)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS track_music_sources (
        id BIGSERIAL PRIMARY KEY,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES music_source_categories(id) ON DELETE CASCADE,
        node_id INTEGER NOT NULL REFERENCES music_source_nodes(id) ON DELETE CASCADE,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(track_id, node_id)
      )
    `);
    await pool.query(`ALTER TABLE music_source_categories ADD COLUMN IF NOT EXISTS uuid UUID`);
    await pool.query(`ALTER TABLE music_source_nodes ADD COLUMN IF NOT EXISTS uuid UUID`);
    await pool.query(`ALTER TABLE music_source_categories ALTER COLUMN uuid SET DEFAULT gen_random_uuid()`);
    await pool.query(`ALTER TABLE music_source_nodes ALTER COLUMN uuid SET DEFAULT gen_random_uuid()`);
    await pool.query(`UPDATE music_source_categories SET uuid = gen_random_uuid() WHERE uuid IS NULL`);
    await pool.query(`UPDATE music_source_nodes SET uuid = gen_random_uuid() WHERE uuid IS NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_music_source_categories_uuid ON music_source_categories(uuid)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_music_source_nodes_uuid ON music_source_nodes(uuid)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_music_source_categories_game ON music_source_categories(game_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_music_source_nodes_lookup ON music_source_nodes(game_id, category_id, parent_id, display_order, name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_music_sources_track ON track_music_sources(track_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_music_sources_game ON track_music_sources(game_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_music_sources_category ON track_music_sources(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_track_music_sources_node ON track_music_sources(node_id)`);
  } catch (e) { console.error('migration music_source_module:', e); }

  // 12. tracks: lyrics_status
  try {
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_status VARCHAR(20)`);
    await pool.query(`
      UPDATE tracks
      SET lyrics_status = CASE
        WHEN lyrics_path IS NOT NULL AND BTRIM(lyrics_path) <> '' THEN 'has'
        ELSE 'none'
      END
      WHERE lyrics_status IS NULL OR BTRIM(lyrics_status) = ''
    `);
    await pool.query(`ALTER TABLE tracks ALTER COLUMN lyrics_status SET DEFAULT 'none'`);
    await pool.query(`ALTER TABLE tracks ALTER COLUMN lyrics_status SET NOT NULL`);
    await pool.query(`ALTER TABLE tracks DROP CONSTRAINT IF EXISTS chk_tracks_lyrics_status`);
    await pool.query(`
      ALTER TABLE tracks
      ADD CONSTRAINT chk_tracks_lyrics_status
      CHECK (lyrics_status IN ('none', 'has', 'instrumental'))
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_lyrics_status ON tracks(lyrics_status)`);
  } catch (e) { console.error('migration tracks_lyrics_status:', e); }

  // 13. album_discs
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS album_discs (
        id SERIAL PRIMARY KEY,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        disc_number INTEGER NOT NULL,
        disc_title VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(album_id, disc_number)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_discs_album ON album_discs(album_id)`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS disc_id INTEGER REFERENCES album_discs(id) ON DELETE SET NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_disc_id ON tracks(disc_id)`);
  } catch (e) { console.error('migration album_discs:', e); }

  // 14. app_settings
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ('first_visit_modal', '{"enabled":false,"title":"欢迎来到 HoYoMusic","content":"本站仅用于音乐欣赏与资料整理。请遵守相关法律法规。","min_stay_seconds":5,"version":"1"}'::jsonb)
      ON CONFLICT (setting_key) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ('site_compliance', '{"enabled":false,"icp_number":"","public_security_number":""}'::jsonb)
      ON CONFLICT (setting_key) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ('maintenance_mode', '{"enabled":false,"expected_end_time":null,"message":"","version":"1"}'::jsonb)
      ON CONFLICT (setting_key) DO NOTHING
    `);
  } catch (e) { console.error('migration app_settings:', e); }

  // 15. users auth extensions
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason VARCHAR(500)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status)`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check') THEN
          ALTER TABLE users
          ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active', 'disabled'));
        END IF;
      END $$
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_verification_codes (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(200) NOT NULL,
        challenge_id UUID,
        code_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE auth_verification_codes ADD COLUMN IF NOT EXISTS challenge_id UUID`);
    await pool.query(`ALTER TABLE auth_verification_codes ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE auth_verification_codes ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_codes_challenge ON auth_verification_codes (challenge_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_verification_codes (LOWER(email), created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_verification_codes (expires_at)`);
    await pool.query(`
      UPDATE users
      SET email_verified = TRUE, is_admin = TRUE, account_status = 'active', status_reason = NULL
      WHERE username = 'admin'
    `);
  } catch (e) { console.error('migration users_auth_extensions:', e); }

  // 16. feedback_messages
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id BIGSERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        contact VARCHAR(200),
        ip VARCHAR(64),
        user_agent VARCHAR(512),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at ON feedback_messages (created_at DESC)`);
  } catch (e) { console.error('migration feedback_messages:', e); }

  // 17. drop legacy artists/track_artists tables (data discarded)
  try {
    await pool.query(`DROP TABLE IF EXISTS track_artists CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS artists CASCADE`);
  } catch (e) { console.error('migration drop_legacy_artists:', e); }
};

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is required. Refusing to start with insecure JWT configuration.');
      process.exit(1);
    }

    const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

    if (STORAGE_MODE === 'oss') {
      // 阿里云 OSS 模式
      console.log('🔗 Testing Aliyun OSS connection...');
      const connected = await testOSSConnection();

      if (!connected) {
        console.error('❌ OSS connection failed. Please check your configuration.');
        console.error('Set OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET in .env file');
        process.exit(1);
      }

      console.log('📁 Initializing OSS storage structure...');
      await initOSSDirectories();
    } else if (STORAGE_MODE === 'webdav') {
      // WebDAV模式：测试连接并初始化目录
      console.log('🔗 Testing WebDAV connection...');
      const connected = await testWebDAVConnection();

      if (!connected) {
        console.error('❌ WebDAV connection failed. Please check your configuration.');
        console.error('Set WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD in .env file');
        process.exit(1);
      }

      console.log('📁 Initializing WebDAV directories...');
      await initWebDAVDirectories();
    } else {
      // 本地存储模式：跳过远程初始化
      console.log('💾 Using local storage mode');
      console.log('📁 Files will be stored in ./uploads directory');
    }

    // Run DB migrations
    await runMigrations();

    // Pre-warm DB connection pool
    const { warmPool } = await import('./config/database');
    await warmPool(3);

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🎵 HoYoMusic Backend Server running on port ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`📖 Public access enabled at /api/public`);
      if (STORAGE_MODE === 'oss') {
        console.log(`☁️  Aliyun OSS storage configured and ready`);
      } else if (STORAGE_MODE === 'webdav') {
        console.log(`☁️  WebDAV storage configured and ready`);
      } else {
        console.log(`💾 Local storage mode active`);
      }
    });

    // ── Graceful shutdown ────────────────────────────────────────
    const shutdown = (signal: string) => {
      console.log(`\n⏳ Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        try {
          await flushVisitLoggerNow();
        } catch (flushError) {
          console.warn('⚠️  visit logger flush warning:', flushError);
        }
        try {
          await pool.end();
          console.log('✅ Database pool closed');
        } catch {}
        console.log('👋 Server shut down');
        process.exit(0);
      });
      // Force kill after 10s
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

