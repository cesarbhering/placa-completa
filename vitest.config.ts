/**
 * Vitest Configuration
 *
 * Unit and component testing configuration for Vue/Nuxt
 */

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // services/ tem suite propria (node --test, usa node:test, que o vite nao
    // consegue bundlar): roda com `npm test` dentro do servico.
    exclude: ['node_modules', 'dist', '.nuxt', 'services/**', 'tests/user-flow.test.ts', 'tests/pwa.test.ts', 'tests/seo.test.ts', 'tests/lead-capture.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/.nuxt/**',
      ],
    },
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
