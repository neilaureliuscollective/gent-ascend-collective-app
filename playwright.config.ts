import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--use-gl=angle',
            '--use-angle=swiftshader',
          ],
        }
      : undefined,
  },
  webServer: [
    {
      command: 'npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'node scripts/component-test-server.mjs',
      url: 'http://127.0.0.1:3102',
      reuseExistingServer: false,
    },
  ],
  reporter: 'list',
});
