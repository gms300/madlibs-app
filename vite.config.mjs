import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { catalogFilesPlugin } from './server/catalog.mjs';

export default defineConfig(({ mode }) => ({
  plugins: [react(), catalogFilesPlugin(loadEnv(mode, process.cwd(), '').VITE_ADMIN_PASSCODE ?? '1234')],
  build: {
    outDir: 'build'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js'
  },
    server: {
    host: true,
    allowedHosts: ['greg-dev.tail91e83c.ts.net']
  }
}));