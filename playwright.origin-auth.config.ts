import { defineConfig } from '@playwright/test';
import base from './playwright.founder.config';
export default defineConfig({
  ...base,
  testDir: 'tests/origin-auth',
  testMatch: 'architect-origin.spec.ts',
  webServer: {
    command:
      'ARCHITECT_ORIGIN_ENABLED=true ARCHITECT_ORIGIN_AI_ENABLED=false npm run dev -- --port 3103',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
