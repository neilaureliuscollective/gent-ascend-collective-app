import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Dedicated loopback server: never attach to another worktree's running build.
export default defineConfig({
  ...base,
  testDir: 'tests',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3250' },
  webServer: {
    command: 'npm run start -- --port 3250',
    url: 'http://127.0.0.1:3250',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
