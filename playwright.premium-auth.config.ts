import { defineConfig } from '@playwright/test';
import base from './playwright.founder.config';
export default defineConfig({
  ...base,
  testDir: 'tests/premium-auth',
  outputDir: 'test-results/premium-auth',
  workers: 1,
  timeout: 240000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3105', video: 'on' },
  webServer: {
    command:
      'AETHELIOS_TALK_CREATION_FIXTURE=lifestyle-launch ARCHITECT_ORIGIN_ENABLED=true ARCHITECT_ORIGIN_AI_ENABLED=false npm run dev -- --port 3105',
    url: 'http://127.0.0.1:3105',
    reuseExistingServer: false,
    timeout: 90000,
  },
});
