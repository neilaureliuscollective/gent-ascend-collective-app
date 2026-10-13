import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// Real Next routing with intercepted synthetic data; never Auth/database acceptance.
export default defineConfig({
  ...base,
  testDir: 'tests/origin-navigation',
  outputDir: 'test-results/origin-navigation',
  workers: 2,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3104' },
  webServer: {
    command: 'npm run start -- --port 3104',
    url: 'http://127.0.0.1:3104',
    reuseExistingServer: false,
    env: {
      APP_ENV: 'local',
      AURELIUS_DEV_HARNESS: 'false',
      ARCHITECT_ORIGIN_ENABLED: 'true',
      ARCHITECT_ORIGIN_AI_ENABLED: 'false',
      AETHELIOS_LIVE_ENABLED: 'false',
      HEALTH_INGESTION_ENABLED: 'false',
      HEALTH_AI_ENABLED: 'false',
    },
  },
});
