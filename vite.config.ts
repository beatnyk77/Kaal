import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const jyotishProxyTarget = env.JYOTISH_PROXY_TARGET || 'http://localhost:9393'

  return {
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@vendor/panchangJS': path.resolve(__dirname, 'vendor/panchangJS/src'),
      '@angular/core': path.resolve(__dirname, 'src/shims/angular-core.ts'),
    },
  },
  optimizeDeps: {
    include: ['sql.js/dist/sql-wasm.js'],
  },
  server: {
    proxy: {
      '/jyotish-api': {
        target: jyotishProxyTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/jyotish-api/, ''),
      },
    },
  },
}})