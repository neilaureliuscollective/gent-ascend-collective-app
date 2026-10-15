import { defineConfig } from '@playwright/test';
import base from './playwright.founder.config';
export default defineConfig({
  ...base,
  testDir: 'tests/origin-auth',
  testMatch: /architect-(origin|apps)\.spec\.ts/,
  timeout: 300000,
  use: {
    ...base.use,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
  },
  webServer: {
    command:
      'ARCHITECT_ORIGIN_ENABLED=true ARCHITECT_ORIGIN_AI_ENABLED=false ARCHITECT_APPS_ENABLED=true ARCHITECT_APPS_AI_MOCK=true ARCHITECT_APPS_PREVIEW_SECRET=origin-apps-preview-secret-key ARCHITECT_APPS_PROCESS_ID=origin-apps-3103 APP_ENV=local npm run dev -- --port 3103',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
