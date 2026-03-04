import express from 'express';
import cors from 'cors';
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
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ extended: true, limit: '2gb' }));
app.use(passport.initialize());

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
app.use('/api/tags', tagRoutes); // Tag routes
app.use('/api/public', publicRoutes); // Public routes (无需认证)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HoYoMusic API is running' });
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

