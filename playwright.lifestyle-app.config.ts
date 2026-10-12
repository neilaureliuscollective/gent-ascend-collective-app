import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/lifestyle-app',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true },
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    timeout: 60000,
  },
  reporter: 'list',
});
