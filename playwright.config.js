/**
 * Playwright configuration for Tradeo E2E tests
 *
 * Run all E2E:       npx playwright test
 * Run single file:   npx playwright test tests/e2e/auth.spec.js
 * Run headed:        npx playwright test --headed
 * Debug:             npx playwright test --debug
 * Report:            npx playwright show-report
 */

const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir:     './tests/e2e',
  testMatch:   ['**/*.spec.js', '**/*.spec.ts'],

  // Max time one test can run
  timeout: 30000,

  // Retry on CI
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // Frontend base URL — override with BASE_URL env var
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Trace on first retry
    trace: 'on-first-retry',

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 15000,
  },

  projects: [
    // Desktop browsers
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    {
      name:  'firefox',
      use:   { ...devices['Desktop Firefox'] },
    },
    // Mobile viewport
    {
      name: 'Mobile Chrome',
      use:  { ...devices['Pixel 5'] },
    },
  ],

  // Start dev server before running tests (comment out if using staging URL)
  webServer: process.env.USE_DEV_SERVER !== 'false'
    ? {
        command:              'npm run dev',
        url:                  'http://localhost:5173',
        reuseExistingServer:  !process.env.CI,
        timeout:              60000,
      }
    : undefined,
})
