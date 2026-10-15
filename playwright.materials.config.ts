import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const port = Number(process.env.MATERIAL_PORT || 3110);
export default defineConfig({
  ...base,
  testDir: 'tests/materials',
  testMatch: 'creation-materials.spec.ts',
  workers: 2,
  use: {
    ...base.use,
    baseURL: `http://127.0.0.1:${port}`,
    video: 'on',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `ARCHITECT_ORIGIN_ENABLED=true npm run start -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.MATERIAL_REUSE_SERVER === 'true',
    timeout: 60000,
  },
});
