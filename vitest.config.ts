import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      'server-only': path.resolve(import.meta.dirname, 'tests/mocks/serverOnlyStub.ts'),
    },
  },
});
