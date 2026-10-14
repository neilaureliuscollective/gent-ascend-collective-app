import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

test('the verified production application serves Obsidian and preserves public entry paths', async ({
  page,
  request,
}) => {
  await expect
    .poll(
      async () => {
        const response = await request.get('/manifest.webmanifest');
        if (!response.ok()) return '';
        return (await response.json()).theme_color;
      },
      { timeout: 120000, intervals: [2000, 5000] },
    )
    .toBe('#070B0A');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      '/',
      '/enter',
      '/app/aethelios',
      '/app/work',
      '/app/studio',
      '/app/ecosystem',
    ]) {
      const response = await page.goto(route);
      expect(response?.ok(), route).toBe(true);
      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('.workspace-loading')).toHaveCount(0);
      const ready: Record<string, string> = {
        '/': '#arrival-title',
        '/enter': '#entrance-title',
        '/app/aethelios': '.aurelius-composer',
        '/app/work': '#company-work-title',
        '/app/studio': '.studio-empty h2',
        '/app/ecosystem': '#ecosystem-title',
      };
      await expect(page.locator(ready[route]!)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      if (route.startsWith('/app/')) {
        await expect(page.locator('.imperial-workspace')).toHaveCSS(
          'background-color',
          ['/app/aethelios', '/app/studio'].includes(route) ? 'rgb(17, 17, 17)' : 'rgb(7, 11, 10)',
        );
        // Talk's approved compact shell exposes destinations inside Tools.
        // Other workspaces retain the six-link primary navigation.
        if (route === '/app/aethelios') {
          await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
          const destinations = page.getByRole('navigation', { name: 'Aethelios destinations' });
          for (const [name, href] of [
            ['Work', '/app/work'],
            ['Architect', '/app/architect'],
            ['Studio', '/app/studio'],
            ['Health', '/app/health'],
            ['Lifestyle', '/app/lifestyle'],
            ['Ecosystem', '/app/ecosystem'],
          ] as const) {
            await expect(destinations.getByRole('link', { name, exact: true })).toHaveAttribute(
              'href',
              href,
            );
          }
          await page.keyboard.press('Escape');
        } else {
          const navigation = page.getByRole('navigation', { name: 'Main navigation' });
          await expect(navigation.getByRole('link')).toHaveCount(7);
          for (const [name, href] of [
            ['Home', '/app'],
            ['Talk', '/app/aethelios'],
            ['Health', '/app/health'],
            ['Work', '/app/work'],
            ['Studio', '/app/studio'],
            ['Lifestyle', '/app/lifestyle'],
            ['Ecosystem', '/app/ecosystem'],
          ] as const) {
            await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute(
              'href',
              href,
            );
          }
        }
      }
      await page.screenshot({
        path: `test-results/production-${route.replaceAll('/', '-') || 'home'}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/');
    await page.getByRole('link', { name: 'Open Aethelios ↗', exact: true }).click();
    await expect(page).toHaveURL(/\/enter$/);
  }
  expect((await request.get('/dev')).status()).toBe(404);
  expect((await request.get('/api/aurelius')).status()).toBeGreaterThanOrEqual(400);
});

test('both production aliases serve the refined material and draft repair bundle', async ({
  page,
  request,
}) => {
  for (const origin of ['https://gentascend.com', 'https://www.gentascend.com']) {
    const response = await page.goto(`${origin}/app/aethelios`);
    expect(response?.ok(), origin).toBe(true);
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
    await expect(page.locator('.imperial-workspace')).toHaveCSS(
      'background-color',
      'rgb(17, 17, 17)',
    );
    const scripts = await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));
    let repair = false;
    for (const url of scripts) {
      const asset = await request.get(url);
      expect(asset.ok()).toBe(true);
      const bytes = await asset.body();
      if (bytes.toString().includes('aethelios-talk-drafts-v2')) {
        repair = true;
        console.log(
          `PUBLIC_DRAFT_REPAIR ${origin} ${new URL(url).pathname} sha256=${createHash('sha256').update(bytes).digest('hex')}`,
        );
      }
    }
    expect(repair, `${origin} must serve the new recovery code`).toBe(true);
  }
});
