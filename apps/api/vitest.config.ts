import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    // Integration tests share a single real MongoDB test database and drop
    // it between files, so files must not run concurrently against it.
    // Per-file module isolation (Vitest's default) still gives each file a
    // fresh copy of process-wide singletons like the in-memory rate limiter.
    fileParallelism: false,
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
