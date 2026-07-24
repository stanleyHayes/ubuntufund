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
    testTimeout: 20000,
    hookTimeout: 20000,
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
