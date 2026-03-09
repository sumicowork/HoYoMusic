import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096, // inline assets < 4KB as base64
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd-core': ['antd'],
          'vendor-antd-icons': ['@ant-design/icons'],
          'vendor-utils': ['axios', 'zustand', 'howler'],
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

