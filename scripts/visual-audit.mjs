// Run after npm run build. Local Chromium measurements, not field/device results.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = 'test-results/visual-audit';
await mkdir(output, { recursive: true });
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
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Audit server failed to start.');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const report = {
    environment:
      'Local production server; headless Chromium, software GPU, no throttling. Not a phone benchmark.',
    screens: [],
    resources: {},
    renderer: {},
  };
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    await page.goto('http://127.0.0.1:3105');
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${output}/command-${width}.png`, fullPage: true });
    report.screens.push({
      width,
      home: await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
      })),
    });
    if (width === 390)
      report.resources.ambient = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((e) => e.toJSON()),
      );
    if (width === 1440) {
      await page.goto('http://127.0.0.1:3105/aurelius');
      await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
      const canvas = page.locator('.welcome-heading .aurelius-presence canvas');
      await expect(canvas).toHaveCount(1);
      await expect(page.locator('.welcome-heading .aurelius-presence')).toHaveAttribute(
        'data-rendered',
        'true',
      );
      await canvas.evaluate((el) =>
        el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
      );
      await expect(
        page.locator('.welcome-heading .aurelius-presence .presence-fallback'),
      ).toBeVisible();
      await canvas.evaluate((el) => el.dispatchEvent(new Event('webglcontextrestored')));
      await expect(page.locator('.welcome-heading .aurelius-presence')).toHaveAttribute(
        'data-rendered',
        'true',
      );
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Pause ambient motion' }).click();
        await expect(canvas).toHaveCount(0);
        await page.getByRole('button', { name: 'Enable ambient motion' }).click();
        await expect(canvas).toHaveCount(1);
      }
      report.renderer = {
        mounted: true,
        simulatedContextLossFallback: true,
        simulatedContextRestore: true,
        threeToggleCleanupCycles: true,
      };
    }
    await page.goto('http://127.0.0.1:3105/aurelius');
    await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/aurelius-${width}.png`, fullPage: true });
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await page.goto('http://127.0.0.1:3105');
  await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
  await page.waitForTimeout(1600);
  report.resources.still = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.toJSON()),
  );
  const sum = (items, pattern) =>
    items.filter((e) => pattern.test(e.name)).reduce((n, e) => n + e.encodedBodySize, 0);
  report.payloads = {
    stillJsBytes: sum(report.resources.still, /\.js(?:\?|$)/),
    ambientJsBytes: sum(report.resources.ambient, /\.js(?:\?|$)/),
    stillImageBytes: sum(report.resources.still, /\/_next\/image/),
    fontsBytes: sum(report.resources.still, /\.woff2/),
    optionalSceneBytes:
      sum(report.resources.ambient, /\.js(?:\?|$)/) - sum(report.resources.still, /\.js(?:\?|$)/),
  };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      { screens: report.screens, renderer: report.renderer, payloads: report.payloads },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
