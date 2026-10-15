import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: 'architect-apps-compiled-mount.spec.ts',
  outputDir: 'test-results/playwright-apps-compiled',
  timeout: 45000,
  use: {
    headless: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
});
