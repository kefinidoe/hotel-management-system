import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // 'node', not 'jsdom': no test currently renders a component, and jsdom@30
    // pulls undici@8 which crashes on Node < 22.22 before a single test runs.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
      ],
    },
    testNamePattern: '.*', 
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

