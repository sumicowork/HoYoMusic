import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd'],
          'vendor-utils': ['axios', 'zustand', 'howler'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

