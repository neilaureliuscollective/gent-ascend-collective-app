import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/label-browser',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:3112',
    headless: true,
    acceptDownloads: true,
    video: 'on',
    launchOptions: {
      slowMo: 150,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node scripts/studio-label-fixture.mjs',
    url: 'http://127.0.0.1:3112',
    timeout: 60000,
  },
  reporter: 'list',
});
