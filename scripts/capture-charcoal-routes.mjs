import { chromium, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  installMaterialFixture,
  openMaterialTalk,
  openMaterialStudio,
  openMaterialArchitect,
  openMaterialDocument,
} from '../tests/fixtures/creation-materials.ts';
const phase = process.env.MATERIAL_PHASE || 'after';
const output = process.env.MATERIAL_OUTPUT_DIR || 'docs/evidence/charcoal-pass';
mkdirSync(output, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const routes = [
  '/',
  '/enter',
  '/join',
  '/membership',
  '/shop',
  '/shop/cart',
  '/lifestyle',
  '/experience',
  '/app',
  '/app/aethelios',
  '/app/studio',
  '/app/architect',
  '/app/work',
  '/app/health',
  '/app/health/labs',
  '/app/health/records',
  '/app/health/history',
  '/app/health/privacy',
  '/app/health/connections',
  '/app/lifestyle',
  '/app/collection',
  '/app/collection/cart',
  '/app/collection/orders',
  '/app/collection/cabinet',
  '/app/grooming',
  '/app/ecosystem',
  '/app/membership',
  '/app/you',
  '/app/founder/connections',
  '/app/captures',
  '/app/ongoing',
  '/app/missions',
  '/app/goals',
  '/app/progress',
  '/app/daily',
  '/app/performance',
  '/app/ascend-profile',
  '/app/world',
  '/app/install',
  '/app/welcome',
  '/app/founder',
];
const representatives = new Set([
  '/',
  '/enter',
  '/app',
  '/app/aethelios',
  '/app/studio',
  '/app/architect',
  '/app/work',
  '/app/health',
  '/app/lifestyle',
  '/app/collection',
  '/app/ecosystem',
  '/app/membership',
  '/app/you',
  '/app/founder/connections',
]);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const rows = [];
for (const [label, width, height] of [
  ['fold', 884, 690],
  ['desktop', 1440, 900],
])
  for (const route of routes) {
    const page = await browser.newPage({
      baseURL: process.env.MATERIAL_BASE_URL || 'http://127.0.0.1:3110',
      viewport: { width, height },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const core = ['/app/aethelios', '/app/studio', '/app/architect'].includes(route);
    let response;
    try {
      if (core) await installMaterialFixture(page);
      if (route === '/app/aethelios') await openMaterialTalk(page);
      else if (route === '/app/studio') await openMaterialStudio(page);
      else if (route === '/app/architect') {
        await openMaterialArchitect(page);
        await openMaterialDocument(page);
      } else response = await page.goto(route);
      await expect.poll(() => page.locator('main').count()).toBeGreaterThan(0);
      await expect(page.locator('.workspace-loading')).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'A moment to reconnect.', exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(1, 1);
      await page.evaluate(
        (y) => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          window.scrollTo({ top: y, left: 0, behavior: 'instant' });
          document.querySelectorAll('.conversation-scroll').forEach((el) => (el.scrollTop = 0));
        },
        route === '/app/studio' ? (width === 884 ? 600 : 120) : 0,
      );
      const data = await page.evaluate(() => ({
        url: location.pathname,
        visibleContent: document.querySelector('main')?.innerText.slice(0, 1500),
        headings: Array.from(document.querySelectorAll('h1,h2'))
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => el.textContent.trim())
          .slice(0, 12),
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((el) =>
          el.textContent.trim().slice(0, 180),
        ),
        overflow: document.documentElement.scrollWidth > innerWidth,
        scrollY,
        focusVisible: document.querySelectorAll(':focus-visible').length,
        tokens: Object.fromEntries(
          ['--io-environment', '--io-navigation', '--io-glass', '--io-text'].map((v) => [
            v,
            getComputedStyle(
              document.querySelector('.imperial-workspace') || document.documentElement,
            ).getPropertyValue(v),
          ]),
        ),
        surfaces: Array.from(
          document.querySelectorAll(
            '.panel,.io-hero,.studio-room-console,.health-stage,.company-work > header,.lifestyle-hero,.product-card,.membership-grid,.aurelius-composer',
          ),
        )
          .filter((el) => el.getBoundingClientRect().width > 0)
          .slice(0, 12)
          .map((el) => ({
            className: el.className,
            background: getComputedStyle(el).background,
            foreground: getComputedStyle(el).color,
            shadow: getComputedStyle(el).boxShadow,
          })),
      }));
      const row = {
        route,
        label,
        viewport: { width, height },
        kind: core ? 'labelled-API-fixture' : 'production-build-default-access-state',
        status: response?.status() || 200,
        ...data,
        errors,
      };
      if (representatives.has(route)) {
        const name = `${phase}-${route === '/' ? 'home' : route.replaceAll('/', '_').slice(1)}-${label}.png`;
        const bytes = await page.screenshot({
          path: output + '/' + name,
          fullPage: false,
          animations: 'disabled',
        });
        row.screenshot = {
          path: name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
      }
      rows.push(row);
    } catch (error) {
      rows.push({
        route,
        label,
        viewport: { width, height },
        unavailable: String(error).slice(0, 300),
        errors,
      });
    }
    await page.close();
  }
await browser.close();
writeFileSync(
  `${output}/${phase}-matrix.json`,
  JSON.stringify({ commit: head, phase, rows }, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      phase,
      commit: head,
      routes: rows.length,
      unavailable: rows.filter((r) => r.unavailable),
      errors: rows.filter((r) => r.errors?.length),
      overflow: rows.filter((r) => r.overflow),
    },
    null,
    2,
  ),
);
