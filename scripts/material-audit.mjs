// Local material/motion audit. Headless, unthrottled; not a physical-device battery or field benchmark.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = 'test-results/material-audit';
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3106'],
  { stdio: 'ignore' },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3106')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error('Material audit server unavailable');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const report = {
    environment:
      'Headless Chromium; no throttling; local production server; frame intervals are requestAnimationFrame samples, not GPU/paint timing or physical phone results.',
    screens: [],
  };
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    await page.goto('http://127.0.0.1:3106');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'ambient');
    await page.getByRole('button', { name: 'Explore a sample day' }).click();
    const frames = await page.evaluate(async () => {
      const times = [];
      // Sample the same arrival animation after fonts/layout have settled.
      await document.fonts.ready;
      document
        .querySelector('.connection-arrival')
        .getAnimations()
        .forEach((animation) => {
          animation.currentTime = 0;
          animation.play();
        });
      for (let i = 0; i < 121; i++)
        times.push(await new Promise((resolve) => requestAnimationFrame(resolve)));
      const intervals = times
        .slice(1)
        .map((time, i) => Number(time) - Number(times[i]))
        .sort((a, b) => a - b);
      return {
        samples: intervals.length,
        medianMs: intervals[60],
        p95Ms: intervals[114],
        maxMs: intervals.at(-1),
        over50ms: intervals.filter((n) => n > 50).length,
      };
    });
    await page.screenshot({ path: `${output}/ambient-${width}.png`, fullPage: true });
    const decoration = await page
      .locator('.connection-arrival')
      .evaluate((el) => ({
        name: getComputedStyle(el).animationName,
        iterations: getComputedStyle(el).animationIterationCount,
        opacity: getComputedStyle(el).opacity,
      }));
    report.screens.push({
      width,
      frames,
      decoration,
      canvasCount: await page.locator('canvas').count(),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    });
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
