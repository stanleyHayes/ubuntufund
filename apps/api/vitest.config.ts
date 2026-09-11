import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    // Integration tests hit a real MongoDB. Each worker connects to its own
    // per-worker database (see __tests__/helpers/testDatabase.ts) so a file's
    // afterAll dropDatabase() can never wipe a neighbouring worker's data.
    // globalSetup sweeps those worker databases before/after the whole run.
    // Files still run one at a time (fileParallelism off), which also keeps
    // process-wide singletons like the in-memory rate limiter from bleeding
    // across files via Vitest's per-file module isolation.
    fileParallelism: false,
    globalSetup: ['./__tests__/helpers/globalSetup.ts'],
    // Clears the process-wide rate-limiter counters before each test.
    setupFiles: ['./__tests__/helpers/testSetup.ts'],
    // Integration tests hit a real mongod and the provider fetch mocks; on a
    // loaded machine an occasional undici socket timeout or slow bcrypt hook can
    // flake a run even though the DBs are per-worker isolated. Retry twice — a
    // genuine failure still fails all attempts — and use generous default
    // timeouts so a plain `vitest run` (no CLI overrides) is resilient too.
    retry: 2,
    testTimeout: 120000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
