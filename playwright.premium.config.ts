import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: 'premium-creative.spec.ts',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:3102',
    headless: true,
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium',
      slowMo: 350,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node scripts/component-test-server.mjs',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: false,
  },
});
