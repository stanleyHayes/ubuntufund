import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
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
