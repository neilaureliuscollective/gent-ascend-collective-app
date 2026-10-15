import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: [
    'intelligence-motion.spec.ts',
    'intelligence-motion-integration.spec.ts',
    'intelligence-motion-identity.spec.ts',
  ],
  use: { baseURL: 'http://127.0.0.1:3102', headless: true },
  webServer: {
    command: 'node scripts/component-test-server.mjs',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: !process.env.CI,
  },
});
