/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.QUB_API_URL ?? 'http://localhost:4100';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    // File-based routes from src/routes -> src/routeTree.gen.ts; each route's component is split into its own chunk.
    tanstackRouter({ target: 'react', autoCodeSplitting: true, quoteStyle: 'single' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5180,
    strictPort: true,
    // Same-origin in development: cookies (refresh/media) and WebSockets work exactly as in production.
    proxy: { '/api': { target: API, changeOrigin: false, ws: true } },
  },
  build: {
    sourcemap: true,
    // The editor (Tiptap/Yjs) and chart chunks are large but only load on the routes that need them.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
