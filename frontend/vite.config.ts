import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5673,
    proxy: {
      '/api': {
        target: 'http://localhost:8680',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://localhost:8680',
        changeOrigin: true,
      },
      '/openapi.json': {
        target: 'http://localhost:8680',
        changeOrigin: true,
      },
    },
  },
})
