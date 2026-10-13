import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// Isolated local release review; CI retains the canonical 3100/3102 config.
process.env.PLAYWRIGHT_FIXTURE_PORT = '3252';
export default defineConfig({
  ...base,
  testDir: 'tests',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3250' },
  webServer: [
    {
      command: 'npm run start -- --port 3250',
      url: 'http://127.0.0.1:3250',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'node scripts/component-test-server.mjs',
      url: 'http://127.0.0.1:3252',
      reuseExistingServer: false,
    },
  ],
});
