import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generate bundle analysis report (only when ANALYZE=true)
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/bundle-report.html',
      open: process.env.ANALYZE_OPEN === 'true',
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096, // inline assets < 4KB as base64
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd-icons': ['@ant-design/icons'],
          'vendor-utils': ['axios', 'zustand', 'howler', 'dayjs'],
          'vendor-markdown': ['react-markdown', 'remark-breaks', 'remark-gfm'],
          'vendor-dnd': ['react-beautiful-dnd', 'react-window'],
          'vendor-recharts': ['recharts'],
        },
        // Put font files in a dedicated /fonts/ directory
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && /\.(woff2?|ttf|eot)$/.test(assetInfo.name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

