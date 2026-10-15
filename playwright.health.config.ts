import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: 'health.spec.ts',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {}),
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        ...(process.env.PLAYWRIGHT_SINGLE_PROCESS === '1' ? ['--single-process'] : []),
        '--use-gl=angle',
        '--use-angle=swiftshader',
      ],
    },
  },
  reporter: 'list',
  webServer: {
    command: 'node scripts/component-test-server.mjs',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: true,
  },
});
