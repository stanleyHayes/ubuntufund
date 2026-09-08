import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single React instance. packages/ui is consumed as source and
    // resolves the hoisted root react, while the app has its own nested copy
    // (version drift: root 19.2.0 vs app 19.2.3); without dedupe that's two
    // Reacts → "Invalid hook call" in the ThemeProvider.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8300,
    open: true,
    proxy: {
      '/api/v1': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8100',
        changeOrigin: true,
      },
    },
  },
})
