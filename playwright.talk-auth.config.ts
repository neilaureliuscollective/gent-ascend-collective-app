import { defineConfig } from '@playwright/test';
import base from './playwright.founder.config';
export default defineConfig({
  ...base,
  testDir: 'tests/talk-auth',
  timeout: 120000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3104' },
  webServer: {
    command:
      'ARCHITECT_ORIGIN_ENABLED=true ARCHITECT_ORIGIN_AI_ENABLED=false npm run dev -- --port 3104',
    url: 'http://127.0.0.1:3104',
    reuseExistingServer: false,
    timeout: 90000,
  },
});
