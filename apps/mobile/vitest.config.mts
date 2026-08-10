import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // .ts only: React Native component tests (.tsx) need jest-expo, which cannot
    // resolve react-native across the hoisted npm workspace — see UbuntuLogo.test.tsx.
    include: ['src/**/__tests__/**/*.test.ts'],
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
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __DEV__: 'false',
  },
})
