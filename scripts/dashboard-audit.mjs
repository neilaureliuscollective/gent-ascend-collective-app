// A local lab audit; no field, physical-phone or live-provider claims.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const out = 'test-results/dashboard-audit';
await mkdir(out, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3105'],
  { stdio: 'ignore' },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3105')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error('Audit server unavailable');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const report = {
    screens: [],
    resources: [],
    environment:
      'Headless Chromium; local production server; reduced motion; no network throttling; synthetic sample only.',
  };
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:3105');
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    if (width === 390)
      report.resources = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((e) => e.toJSON()),
      );
    await page.screenshot({ path: `${out}/empty-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Explore a sample day' }).click();
    await expect(page.getByText('Sample experience', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${out}/dashboard-${width}.png`, fullPage: true });
    await page.screenshot({ path: `${out}/viewport-${width}.png` });
    report.screens.push({
      width,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      errors,
    });
    if (width === 390) {
      await page.getByRole('button', { name: 'Update your check-in' }).click();
      await page.screenshot({ path: `${out}/checkin-phone.png` });
      await page.keyboard.press('Escape');
    }
    await page.close();
  }
  report.payload = {
    jsBytes: report.resources
      .filter((e) => /\.js(?:\?|$)/.test(e.name))
      .reduce((n, e) => n + e.encodedBodySize, 0),
    cssBytes: report.resources
      .filter((e) => /\.css(?:\?|$)/.test(e.name))
      .reduce((n, e) => n + e.encodedBodySize, 0),
  };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ screens: report.screens, payload: report.payload }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
