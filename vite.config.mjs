import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js'
  },
    server: {
    host: true,
    allowedHosts: ['greg-dev.tail91e83c.ts.net']
  }
});