import { test, expect, type Page } from './fixtures';
import { disconnectedWorkspace } from '../../src/components/aurelius/preview';

test.use({ deviceScaleFactor: 2 });

const project = '10000000-0000-4000-8000-000000000001';
const field = (page: Page) => page.getByLabel('Message Aethelios', { exact: true });
async function fixtures(page: Page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius')
      return route.fulfill({
        json: {
          ...disconnectedWorkspace,
          ownerId: 'material-review-synthetic',
          configured: true,
          canChat: true,
          model: 'synthetic',
        },
      });
    if (url.pathname === '/api/studio')
      return route.fulfill({
        json: {
          owner: 'material-review-synthetic',
          projectId: project,
          projects: [
            {
              id: project,
              title: 'Synthetic campaign',
              creative_type: 'campaign',
              brief: {
                purpose: 'A considered launch',
                audience: 'Review audience',
                direction: 'Clear, quiet and deliberate',
                palette: 'Emerald and gold',
                avoid: 'False claims',
              },
              updated_at: '2026-10-13T00:00:00Z',
            },
          ],
          versions: [],
          references: [],
          scenes: [],
          finishes: [],
          configured: true,
          canCreate: true,
        },
      });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  // Browser-only deterministic streaming transport. No provider or private records.
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== '/api/aurelius/chat') return original(input, init);
      let timer: ReturnType<typeof setTimeout>;
      const stream = new ReadableStream({
        start(controller) {
          const write = (event: unknown) =>
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          write({ type: 'activity', phase: 'generating' });
          write({
            type: 'delta',
            text: 'Synthetic streaming review. A clear plan starts with the next useful decision.',
          });
          timer = setTimeout(() => controller.close(), 30000);
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              controller.close();
            },
            { once: true },
          );
        },
        cancel() {
          clearTimeout(timer);
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
    };
  });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
  );
  expect(fonts.some((family) => /inter/i.test(family))).toBe(true);
  expect(fonts.some((family) => /sora/i.test(family))).toBe(true);
  console.log(`LOADED_FONTS ${name} DPR=2 ${fonts.join(', ')}`);
  await page.screenshot({
    path: `test-results/obsidian-${name}.png`,
    fullPage: true,
    scale: 'device',
  });
}
// Sample the actual composited raster behind text, including SVG/gradient layers.
// Hide only glyphs/caret for the sample; geometry and all background paint remain.
async function contrast(page: Page, selector: string) {
  const element = page.locator(selector).first();
  await element.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const original = await element.getAttribute('style');
  const ink = await element.evaluate((el) => getComputedStyle(el).color);
  await element.evaluate((el) => el.setAttribute('data-contrast-sample', 'true'));
  const hiding = await page.addStyleTag({
    content:
      '[data-contrast-sample], [data-contrast-sample] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }',
  });
  await element.evaluate((el: HTMLElement) => {
    el.style.setProperty('color', 'transparent', 'important');
    el.style.setProperty('caret-color', 'transparent', 'important');
    el.style.setProperty('text-shadow', 'none', 'important');
  });
  const png = (await element.screenshot()).toString('base64');
  await element.evaluate((el, style) => {
    if (style === null) el.removeAttribute('style');
    else el.setAttribute('style', style);
  }, original);
  await hiding.evaluate((el) => el.parentNode?.removeChild(el));
  await element.evaluate((el) => el.removeAttribute('data-contrast-sample'));
  const ratio = await page.evaluate(
    async ({ png, ink }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + png;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const luminance = (rgb: number[]) =>
        rgb
          .slice(0, 3)
          .map((c) => {
            const v = c / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const fg = luminance(ink.match(/[\d.]+/g)!.map(Number));
      const ratios: number[] = [];
      for (const x of [0.2, 0.4, 0.6, 0.8])
        for (const y of [0.3, 0.5, 0.7]) {
          const bg = luminance([
            ...ctx.getImageData(Math.floor(img.width * x), Math.floor(img.height * y), 1, 1).data,
          ]);
          ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05));
        }
      return Math.min(...ratios);
    },
    { png, ink },
  );
  expect(ratio, `${selector} composited contrast`).toBeGreaterThanOrEqual(4.5);
  console.log(`COMPOSITED_CONTRAST ${selector} ${ratio.toFixed(2)}:1`);
}

for (const width of [344, 720, 1440]) {
  test(`smoked Talk empty, focused keyboard, drawer and streaming at ${width}`, async ({
    page,
  }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/aethelios');
    await expect(field(page)).toBeEnabled();
    await expect(page.locator('.talk-welcome-presence')).toBeVisible();
    await expect(page.locator('.talk-expand svg[aria-hidden="true"]')).toBeVisible();
    await expect(page.locator('.conversation-starters button svg[aria-hidden="true"]')).toHaveCount(
      3,
    );
    await expect(page.locator('.conversation-starters')).not.toContainText('↗');
    await noOverflow(page);
    await shot(page, `talk-empty-${width}`);
    await contrast(page, '.conversation-starters button');
    await field(page).fill('Synthetic material review\n'.repeat(12));
    await field(page).focus();
    await contrast(page, '.talk-input');
    await expect(page.locator('.composer-controls .button')).toHaveCSS(
      'background-color',
      'rgb(196, 145, 47)',
    );
    await expect(page.locator('.composer-controls .button')).toHaveCSS('color', 'rgb(17, 17, 17)');
    await contrast(page, '.composer-controls .button');
    await page.setViewportSize({ width, height: 480 });
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
    await expect(field(page)).toBeFocused();
    await noOverflow(page);
    await shot(page, `talk-keyboard-${width}`);
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Tools & context', exact: true });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.locator('a.text-link', { hasText: 'Missions' }).locator('svg'),
    ).toBeVisible();
    const meet = drawer.getByRole('button', { name: 'Meet the Intelligence Team' });
    const assemble = drawer.getByRole('button', { name: 'Assemble Around This' });
    const a = await meet.boundingBox(),
      b = await assemble.boundingBox();
    expect(a && b && (b.y >= a.y + a.height + 7 || b.x >= a.x + a.width + 7)).toBeTruthy();
    await shot(page, `tools-${width}`);
    await page.keyboard.press('Escape');
    await expect(field(page)).toHaveValue('Synthetic material review\n'.repeat(12));
    await field(page).fill('Synthetic material review');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.assistant-message')).toContainText('Synthetic streaming review');
    await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
    await shot(page, `talk-streaming-${width}`);
    await page.getByRole('button', { name: 'Stop reply' }).click();
    await noOverflow(page);
  });
  test(`smoked Studio content, selected tabs and fallback at ${width}`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/app/studio');
    await expect(
      page.getByRole('heading', { name: 'Synthetic campaign', exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await expect(page.locator('.studio-world-heading a svg[aria-hidden="true"]')).toBeVisible();
    const rooms = page.getByRole('group', { name: 'Studio workspace views' });
    await expect(rooms.getByRole('button')).toHaveCount(10);
    await expect(rooms.getByRole('button', { name: 'Design', exact: true })).toBeVisible();
    await expect(rooms.getByRole('button', { name: 'Film', exact: true })).toBeVisible();
    await rooms.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('.studio-paths button svg[aria-hidden="true"]')).toHaveCount(5);
    await expect(page.locator('.studio-page')).not.toContainText('↗');
    await shot(page, `studio-${width}`);
    await contrast(
      page,
      '.studio-view-tabs button:not([aria-pressed="true"]) .studio-room-copy strong',
    );
    await contrast(
      page,
      '.studio-view-tabs button:not([aria-pressed="true"]) .studio-room-copy small',
    );
    await page.locator('.studio-view-tabs button').last().click();
    await noOverflow(page);
    await page.locator('.studio-view-tabs button').first().click();
    await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
    await expect(page.locator('.studio-projects')).toHaveCSS('background-image', 'none');
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    await expect(page.locator('.studio-projects')).toHaveCSS('background-image', 'none');
    await page.locator('.studio-view-tabs button').first().focus();
    await expect(page.locator('.studio-view-tabs button').first()).toHaveCSS(
      'outline-style',
      'solid',
    );
    await shot(page, `studio-accessible-${width}`);
  });
}
