import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  testDir: 'tests/founder',
  workers: 1,
  timeout: 60000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3103' },
  webServer: {
    command: 'npm run dev -- --port 3103',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: 'list',
});
