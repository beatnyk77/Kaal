import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@vendor/panchangJS': path.resolve(__dirname, 'vendor/panchangJS/src'),
      '@angular/core': path.resolve(__dirname, 'src/shims/angular-core.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    proxy: {
      '/jyotish-api': {
        target: 'http://localhost:9393',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/jyotish-api/, ''),
      },
    },
  },
})