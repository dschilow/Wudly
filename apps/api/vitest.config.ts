import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Vitest config for the API.
 *
 * Uses the SWC plugin so NestJS decorators/metadata compile correctly in tests.
 * Tests run single-threaded (singleFork) because the integration suites share a
 * real local Postgres and must not race each other.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
