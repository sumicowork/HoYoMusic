import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import passport from './config/passport';
import pool from './config/database';
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
import { visitLogger } from './middleware/visitLogger';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Managed by Nginx in production
}));

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

// ── Core Middleware ─────────────────────────────────────────────
app.use(cors());
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
app.use('/api/analytics', analyticsRoutes); // Analytics (authenticated)
app.use('/api/public', publicRoutes);    // Public routes (无需认证)

// Health check (with database connectivity test)
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1 AS ok');
    const dbOk = dbResult.rows.length > 0;
    res.json({
      success: true,
      message: 'HoYoMusic API is running',
      database: dbOk ? 'connected' : 'error',
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

    // Start server
    app.listen(PORT, () => {
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

