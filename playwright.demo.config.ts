import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'scripts',
  testMatch: 'conversation-motion-demo.spec.ts',
  outputDir: '/tmp/motion-demo-output',
  use: {
    baseURL: 'http://127.0.0.1:3102',
    headless: true,
    video: { mode: 'on', size: { width: 390, height: 844 } },
  },
});
