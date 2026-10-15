import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: [
    'bplus-talk.spec.ts',
    'shell.spec.ts',
    'interaction-migration.spec.ts',
    'public-world.spec.ts',
    'company-platform.spec.ts',
  ],
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
  },
  reporter: 'list',
});
