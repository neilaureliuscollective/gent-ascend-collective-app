import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: [
    'lifestyle-phase-one.spec.ts',
    'lifestyle-atelier.spec.ts',
    'lifestyle-discovery.spec.ts',
    'member-lifestyle.spec.ts',
  ],
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3102',
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node scripts/component-test-server.mjs',
    url: 'http://127.0.0.1:3102',
    timeout: 45000,
  },
  reporter: 'list',
});
