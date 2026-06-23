import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@vendor/panchangJS': path.resolve(__dirname, 'vendor/panchangJS/src'),
      '@angular/core': path.resolve(__dirname, 'src/shims/angular-core.ts'),
    },
  },
})