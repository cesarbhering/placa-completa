import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for E2E tests
 * Disables Google Analytics to avoid polluting production metrics
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    // Disable Google Analytics during tests
    extraHTTPHeaders: {
      'DNT': '1', // Do Not Track header
    },
  },

  // Set environment variable to disable analytics in the app
  webServer: {
    command: 'DISABLE_ANALYTICS=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
