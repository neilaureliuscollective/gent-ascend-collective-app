import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: ['live-voice.spec.ts'],
  fullyParallel: true,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:3102', headless: true },
  webServer: {
    command: 'node scripts/component-test-server.mjs',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: false,
  },
});
