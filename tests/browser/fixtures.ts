import { test as base } from '@playwright/test';
export { expect, type Page } from '@playwright/test';

// Restricted runners may require Headless Shell in one process. Chromium cannot
// reliably reuse that process after closing its first context, so isolate tests.
// Normal local/CI execution retains Playwright's default browser lifecycle.
export const test =
  process.env.PLAYWRIGHT_SINGLE_PROCESS === '1'
    ? base.extend({
        context: async ({ playwright }, runContext, testInfo) => {
          const browser = await playwright.chromium.launch({
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
            headless: true,
            args: [
              '--no-sandbox',
              '--no-zygote',
              '--single-process',
              '--disable-dev-shm-usage',
              '--use-gl=angle',
              '--use-angle=swiftshader',
            ],
          });
          const context = await browser.newContext({
            baseURL: testInfo.project.use.baseURL,
            viewport: testInfo.project.use.viewport,
          });
          try {
            await runContext(context);
          } finally {
            await context.close();
            await browser.close();
          }
        },
      })
    : base;
