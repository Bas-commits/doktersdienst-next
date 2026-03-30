import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'e2e/**', '.next/**', 'infra/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
