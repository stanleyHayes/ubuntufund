import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    alias: {
      'react-native': 'react-native-web',
    },
    server: {
      deps: {
        inline: ['react-native-paper', 'react-native-safe-area-context', '@testing-library/react-native'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __DEV__: 'false',
  },
})
