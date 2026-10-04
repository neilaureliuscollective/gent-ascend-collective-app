import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3105'],
  { stdio: 'ignore' },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3105/app')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: [
      '--no-sandbox',
      '--no-zygote',
      '--single-process',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await page.goto('http://127.0.0.1:3105/app');
  await page.waitForLoadState('networkidle');
  const payload = await page.evaluate(() => {
    const r = performance.getEntriesByType('resource');
    return {
      js: r.filter((e) => /\.js(?:\?|$)/.test(e.name)).reduce((s, e) => s + e.encodedBodySize, 0),
      css: r.filter((e) => /\.css(?:\?|$)/.test(e.name)).reduce((s, e) => s + e.encodedBodySize, 0),
    };
  });
  await mkdir('test-results', { recursive: true });
  await writeFile(process.argv[2] ?? 'test-results/command-payload.json', JSON.stringify(payload));
  console.log(payload);
} finally {
  await browser?.close();
  server.kill();
}
