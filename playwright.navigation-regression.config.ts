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
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
  },
  webServer: [
    {
      command: 'npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/component-test-server.mjs',
      url: 'http://127.0.0.1:3102',
      reuseExistingServer: false,
    },
  ],
  reporter: 'list',
});
