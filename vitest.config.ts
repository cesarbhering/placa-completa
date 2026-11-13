/**
 * Vitest Configuration
 *
 * Unit and component testing configuration for Vue/Nuxt
 */

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

// Nuxt replaces import.meta.client/server/dev at build time; plain Vite leaves
// them undefined. Components whose client branches are exercised by mounted
// tests get the browser values here (scoped, so other tests are unchanged).
const MONTADOS_NO_CLIENTE = ['/components/PremiumInlineCheckout.vue']
const importMetaCliente = {
  name: 'test-import-meta-client',
  enforce: 'post' as const,
  transform(code: string, id: string) {
    if (!MONTADOS_NO_CLIENTE.some((f) => id.split('?')[0].endsWith(f))) return null
    return {
      code: code.replace(/import\.meta\.client/g, 'true').replace(/import\.meta\.server/g, 'false').replace(/import\.meta\.dev/g, 'false'),
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [vue(), importMetaCliente],
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
