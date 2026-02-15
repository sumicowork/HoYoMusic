import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from './config/passport';
import { initWebDAVDirectories, testWebDAVConnection } from './config/webdav';
import authRoutes from './routes/authRoutes';
import trackRoutes from './routes/trackRoutes';
import publicRoutes from './routes/publicRoutes';
import lyricsRoutes from './routes/lyricsRoutes';
import creditsRoutes from './routes/creditsRoutes';
import albumRoutes from './routes/albumRoutes';
import artistRoutes from './routes/artistRoutes';
import gameRoutes from './routes/gameRoutes';
import playlistRoutes from './routes/playlistRoutes';
import tagRoutes from './routes/tagRoutes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// 注意: 文件现在存储在WebDAV服务器上，不再需要静态文件服务
// 前端将直接访问WebDAV公开URL

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracks', trackRoutes); // Admin routes (需要认证)
app.use('/api/lyrics', lyricsRoutes); // Lyrics routes
app.use('/api/credits', creditsRoutes); // Credits routes
app.use('/api/albums', albumRoutes); // Album routes
app.use('/api/artists', artistRoutes); // Artist routes
app.use('/api/games', gameRoutes); // Game routes
app.use('/api/playlists', playlistRoutes); // Playlist routes
app.use('/api/tags', tagRoutes); // Tag routes
app.use('/api/public', publicRoutes); // Public routes (无需认证)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HoYoMusic API is running' });
});

// Error handler (should be last)
app.use(errorHandler);

// Initialize WebDAV and start server
const startServer = async () => {
  try {
    // Test WebDAV connection
    console.log('🔗 Testing WebDAV connection...');
    const connected = await testWebDAVConnection();

    if (!connected) {
      console.error('❌ WebDAV connection failed. Please check your configuration.');
      console.error('Set WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD in .env file');
      process.exit(1);
    }

    // Initialize WebDAV directories
    console.log('📁 Initializing WebDAV directories...');
    await initWebDAVDirectories();

    // Start server
    app.listen(PORT, () => {
      console.log(`🎵 HoYoMusic Backend Server running on port ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`📖 Public access enabled at /api/public`);
      console.log(`☁️  WebDAV storage configured and ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

