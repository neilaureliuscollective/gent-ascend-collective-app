import { chromium } from '@playwright/test';

const dest = process.argv[2] || '/opt/cursor/artifacts/ecosystem_membership_journey.webm';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
  recordVideo: { dir: '/tmp/ecosystem-demo', size: { width: 1440, height: 960 } },
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:3100/app/ecosystem', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.getByRole('radio', { name: 'Build a useful tool' }).check();
await page.waitForTimeout(900);
await page.getByPlaceholder('A quiet estimator for materials, time and cost.').fill(
  'Estimate cedar and brass for a small cabinet.',
);
await page.waitForTimeout(700);
await page.getByRole('link', { name: 'Inspect the example' }).click();
await page.waitForTimeout(1000);
await page.getByRole('radio', { name: 'I want to make reusable work' }).check();
await page.waitForTimeout(400);
await page.getByRole('radio', { name: 'As a regular part of my work' }).check();
await page.waitForTimeout(900);
await page.locator('#ecosystem-membership').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Select Continuum' }).first().click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Select Access' }).first().click();
await page.locator('.eco-next').scrollIntoViewIfNeeded();
await page.waitForTimeout(1600);
await context.close();
const video = page.video();
if (video) {
  const path = await video.path();
  const { copyFile, mkdir } = await import('node:fs/promises');
  await mkdir(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
  await copyFile(path, dest);
  console.log(dest);
}
await browser.close();
