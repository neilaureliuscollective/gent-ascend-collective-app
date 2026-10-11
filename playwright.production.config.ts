import { defineConfig } from '@playwright/test';

// Public, signed-out production smoke only. No credentials or private records are used.
export default defineConfig({
  testDir: 'tests/production',
  timeout: 180000,
  use: { baseURL: 'https://www.gentascend.com', headless: true },
  reporter: 'list',
});
