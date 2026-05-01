import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@email': path.resolve(__dirname, 'email'),
    },
  },
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'e2e/**', '.next/**', 'infra/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
