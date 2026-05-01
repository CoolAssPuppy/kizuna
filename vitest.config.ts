/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite reads VITE_-prefixed values out of `process.env` at boot, so seeding
// safe defaults here means CI runners (which have no .env file) satisfy the
// app's `requireEnv()` checks without throwing. Real values from .env or
// the Vercel build env still take precedence — `??=` only fills when the
// variable is genuinely absent. Tests never hit the network, so the URL
// only needs to parse cleanly.
process.env.VITE_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable-key';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
});
