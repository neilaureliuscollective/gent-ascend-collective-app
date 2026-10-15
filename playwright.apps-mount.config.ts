import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: 'tests/browser',
  testMatch: 'architect-apps-compiled-mount.spec.ts',
  testIgnore: [],
  webServer: undefined,
});
