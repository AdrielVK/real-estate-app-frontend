import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // The suite is ~885 jsdom tests run in parallel; on an 8-core machine
    // under load, the heaviest userEvent flows (multi-field form submits)
    // exceed the 5s default non-deterministically — different tests fail
    // each run, all as pure timeouts, while focused runs are green. The
    // headroom decouples flakiness from machine load without changing
    // any test semantics.
    testTimeout: 20000,
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      exclude: [
        '**/*.config.{ts,js,mjs,cjs,mts,cts}',
        '**/*.d.ts',
        '**/tests/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/mocks/**',
        '**/generated/**',
        '**/e2e/**',
        '**/.next/**',
      ],
    },
  },
});
