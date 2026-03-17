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
import { visitLogger } from './middleware/visitLogger';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ── CORS Configuration ──────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGINS;
app.use(cors(corsOrigins ? {
  origin: corsOrigins.split(',').map(s => s.trim()).filter(Boolean),
  credentials: true,
} : undefined)); // undefined = allow all (dev mode)

// ── Request Timeout ─────────────────────────────────────────────
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '60000');
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

// 本地存储模式下，提供静态文件访问（远程存储模式下文件直接从远程 URL 获取）
const STATIC_STORAGE_MODE = process.env.STORAGE_MODE || 'local';
if (STATIC_STORAGE_MODE === 'local') {
  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  app.use('/uploads', express.static(uploadDir));
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
const runMigrations = async () => {
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
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_artist_aliases_alias
      ON artist_aliases (LOWER(alias_name))
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_artist_aliases_canonical
      ON artist_aliases (LOWER(canonical_name))
    `);
    console.log('✅ DB migrations up to date (artist_aliases)');
  } catch (err) {
    console.error('⚠️  Migration warning (non-fatal):', err);
  }

  // visit_logs for analytics
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
    console.log('✅ DB migrations up to date (visit_logs)');
  } catch (err) {
    console.error('⚠️  visit_logs migration warning:', err);
  }

  // playlists
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
    console.log('✅ DB migrations up to date (playlists)');
  } catch (err) {
    console.error('⚠️  playlists migration warning:', err);
  }

  // favorites
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
    console.log('✅ DB migrations up to date (favorites)');
  } catch (err) {
    console.error('⚠️  favorites migration warning:', err);
  }

  // Add sha256_hash and play_count columns to tracks
  try {
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64)`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(sha256_hash) WHERE sha256_hash IS NOT NULL`);
    console.log('✅ DB migrations up to date (tracks: sha256_hash, play_count)');
  } catch (err) {
    console.error('⚠️  tracks column migration warning:', err);
  }

  // Add notes column to albums and tracks
  try {
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS notes TEXT`);
    console.log('✅ DB migrations up to date (albums/tracks: notes)');
  } catch (err) {
    console.error('⚠️  notes column migration warning:', err);
  }

  // Album disc subdivision
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
    console.log('✅ DB migrations up to date (album_discs, tracks.disc_id)');
  } catch (err) {
    console.error('⚠️  album_discs migration warning:', err);
  }
};

const startServer = async () => {
  try {
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

