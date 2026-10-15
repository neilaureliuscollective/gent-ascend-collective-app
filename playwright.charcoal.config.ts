import { defineConfig } from '@playwright/test';
import base from './playwright.materials.config';
export default defineConfig({
  ...base,
  testMatch: 'app-charcoal.spec.ts',
  workers: 1,
  timeout: 300000,
  use: { ...base.use, video: 'off' },
});
