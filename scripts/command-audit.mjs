// Local production lab evidence; synthetic sample, never physical-device claims.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const out = process.env.COMMAND_AUDIT_OUTPUT || 'test-results/command-audit';
await mkdir(out, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3105'],
  { stdio: 'ignore' },
);
const report = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3105/app')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const [width, height, motion, large] of [
    [344, 740, 'reduce', false],
    [390, 844, 'reduce', false],
    [360, 640, 'reduce', true],
    [768, 900, 'reduce', false],
    [820, 1180, 'reduce', false],
    [1440, 900, 'reduce', false],
    [390, 844, 'no-preference', false],
  ]) {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
      args: [
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
        '--use-gl=angle',
        '--use-angle=swiftshader',
      ],
    });
    try {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1:3105/app');
      await page.getByRole('button', { name: 'Explore a sample day' }).click();
      if (large) await page.addStyleTag({ content: 'html{font-size:200%}' });
      if (motion === 'no-preference')
        await page
          .locator('.command-presence canvas')
          .waitFor({ state: 'attached', timeout: 10000 })
          .catch(() => {});
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => window.scrollTo(0, 0));
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        overflowElements: [...document.querySelectorAll('body *')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'
            );
          })
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            right: e.getBoundingClientRect().right,
          })),
        moveTop: document.querySelector('.command-next h2').getBoundingClientRect().top,
        canvases: document.querySelectorAll('.command-presence canvas').length,
        resources: performance
          .getEntriesByType('resource')
          .map((e) => ({ name: e.name, bytes: e.encodedBodySize })),
      }));
      await page.screenshot({
        path: `${out}/${width}x${height}-${motion}${large ? '-large' : ''}.png`,
      });
      if (motion === 'no-preference') {
        await page.getByRole('button', { name: 'Pause ambient motion' }).click();
        await page.waitForTimeout(100);
        metrics.canvasesAfterStill = await page.locator('.command-presence canvas').count();
      }
      report.push({ width, height, motion, large, errors, ...metrics });
    } finally {
      await browser.close();
    }
  }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      report.map((r) => ({ ...r, resources: undefined })),
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
