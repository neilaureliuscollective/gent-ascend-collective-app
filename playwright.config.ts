import { defineConfig } from '@playwright/test';
const appPort = Number(process.env.PLAYWRIGHT_APP_PORT ?? 3100);
const componentPort = Number(process.env.PLAYWRIGHT_COMPONENT_PORT ?? 3102);
for (const port of [appPort, componentPort]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid browser-test port');
}
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  // Software-rendered CI needs time for hydration; assertions remain unchanged.
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            ...(process.env.PLAYWRIGHT_SINGLE_PROCESS === '1' ? ['--single-process'] : []),
            '--use-gl=angle',
            '--use-angle=swiftshader',
          ],
        }
      : undefined,
  },
  webServer: [
    {
      command: `npm run start -- --port ${appPort}`,
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'node scripts/component-test-server.mjs',
      url: `http://127.0.0.1:${componentPort}`,
      reuseExistingServer: false,
    },
  ],
  reporter: 'list',
});
