// Headless software-WebGL audit. Not physical-device FPS, heat or battery evidence.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = 'test-results/orb-audit';
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3107'],
  { stdio: 'ignore' },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3107')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Orb audit server unavailable');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const report = {
    environment:
      'Headless Chromium, SwiftShader software WebGL2, local production server, no network throttling. Frame samples are browser requestAnimationFrame intervals, not GPU timings or physical-device results.',
    screens: [],
  };
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      deviceScaleFactor: 1.5,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /shader|THREE|WebGL/.test(message.text()))
        errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:3107/aurelius');
    const orb = page.locator('.orb-presentation .aurelius-presence');
    await expect(orb).toHaveAttribute('data-rendered', 'true', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/workspace-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Explore the Orb' }).click();
    await page
      .getByRole('group', { name: 'Orb motion preview' })
      .getByRole('button', { name: 'Speaking', exact: true })
      .click();
    await expect(orb).toHaveAttribute('data-animating', 'true');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${output}/preview-${width}.png`, fullPage: true });
    await orb.screenshot({ path: `${output}/orb-${width}.png` });
    const metrics = await page.evaluate(async () => {
      const times = [];
      for (let i = 0; i < 121; i++)
        times.push(await new Promise((resolve) => requestAnimationFrame(resolve)));
      const intervals = times
        .slice(1)
        .map((time, i) => Number(time) - Number(times[i]))
        .sort((a, b) => a - b);
      const resources = performance.getEntriesByType('resource').map((e) => e.toJSON());
      const canvas = document.querySelector('.presence-canvas');
      return {
        frames: {
          samples: intervals.length,
          medianMs: intervals[60],
          p95Ms: intervals[114],
          maxMs: intervals.at(-1),
          over50ms: intervals.filter((n) => n > 50).length,
        },
        canvas: {
          width: canvas.width,
          height: canvas.height,
          quality: canvas.parentElement.dataset.quality,
          rendered: canvas.parentElement.dataset.rendered,
          fallback: canvas.parentElement.dataset.fallback || null,
        },
        jsBytesIncludingDeferredScene: resources
          .filter((e) => /\.js(?:\?|$)/.test(e.name))
          .reduce((n, e) => n + e.encodedBodySize, 0),
        cssBytes: resources
          .filter((e) => /\.css(?:\?|$)/.test(e.name))
          .reduce((n, e) => n + e.encodedBodySize, 0),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    await page.getByRole('button', { name: 'Pause ambient motion' }).click();
    await expect(page.locator('.presence-canvas')).toHaveCount(0);
    await orb.screenshot({ path: `${output}/orb-still-${width}.png` });
    report.screens.push({ width, errors, ...metrics });
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
