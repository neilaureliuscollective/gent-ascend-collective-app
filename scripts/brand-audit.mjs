// Run against a local production server. Viewports are not physical-device testing.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const output = 'test-results/gent-ascend';
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3107'],
  { stdio: 'ignore' },
);
let ready = false;
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch('http://127.0.0.1:3107', { signal: AbortSignal.timeout(2000) })).ok) {
      ready = true;
      break;
    }
  } catch {
    /* Starting. */
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready) {
  server.kill();
  throw new Error('Production server did not start');
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const report = [];
try {
  for (const width of [320, 344, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const route of ['/app', '/app/you', '/app/world', '/app/aethelios', '/app/goals', '/app/progress']) {
      await page.goto(`http://127.0.0.1:3107${route}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.documentElement.dataset.motion === 'still');
      if (route === '/app/aethelios') await page.getByLabel('Message Aethelios').waitFor();
      await page.screenshot({
        path: `${output}/${route === '/app' ? 'command' : route.slice(1).replaceAll('/', '-')}-${width}.png`,
        fullPage: true,
      });
      report.push({
        width,
        route,
        errors: [...errors],
        ...(await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          oldBrand: document.body.innerText.includes('Aurelius'),
          missingImages: [...document.images]
            .filter((i) => i.offsetWidth && (!i.complete || !i.naturalWidth))
            .map((i) => i.src),
        }))),
      });
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 768, height: 960 } });
  await page.goto('http://127.0.0.1:3107/aethelios');
  await page.locator('.presence-canvas').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${output}/aethelios-3d-768.png`, fullPage: true });
  await page.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (report.some((r) => r.overflow || r.oldBrand || r.errors.length || r.missingImages.length))
    process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
