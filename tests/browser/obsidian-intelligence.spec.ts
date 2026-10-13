import { test, expect } from './fixtures';

// Real production-route rendering; no authentication or provider behavior is bypassed.
for (const viewport of [
  { width: 344, height: 882 }, // Fold cover
  { width: 390, height: 844 },
  { width: 720, height: 960 }, // unfolded portrait
  { width: 960, height: 720 }, // unfolded landscape
  { width: 1440, height: 900 }, // DeX / desktop
  { width: 2560, height: 1440 },
]) {
  test(`Obsidian product surfaces reflow at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      '/',
      '/enter',
      '/app/aethelios',
      '/app/work',
      '/app/studio',
      '/app/ecosystem',
      '/app/you',
      '/app/missions',
    ]) {
      await page.goto(route);
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
      if (ready[route]) await expect(page.locator(ready[route])).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      if (route.startsWith('/app/')) {
        const compactTalk = route === '/app/aethelios';
        if (compactTalk)
          await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
        const navigation = page.getByRole('navigation', {
          name: compactTalk ? 'Aethelios destinations' : 'Main navigation',
        });
        await expect(navigation.getByRole('link')).toHaveCount(compactTalk ? 11 : 6);
        await expect(navigation.getByRole('link', { name: 'Health', exact: true })).toHaveAttribute(
          'href',
          '/app/health',
        );
        await expect(
          navigation.getByRole('link', { name: 'Lifestyle', exact: true }),
        ).toHaveAttribute('href', '/app/lifestyle');
        // A semantic-token cycle previously made inherited backgrounds transparent.
        const surface = await page.locator('.imperial-workspace').evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          text: getComputedStyle(el).color,
        }));
        const smoked = ['/app/aethelios', '/app/studio'].includes(route);
        expect(surface.background).toBe(smoked ? 'rgb(17, 17, 17)' : 'rgb(7, 11, 10)');
        expect(surface.text).toBe(smoked ? 'rgb(242, 242, 238)' : 'rgb(232, 233, 226)');
        for (const link of await navigation.getByRole('link').all()) {
          const box = await link.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        if (compactTalk) await page.keyboard.press('Escape');
      }
      await page.screenshot({
        path: `test-results/obsidian-${route.replaceAll('/', '-') || 'home'}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

test('navigation and writing remain accessible with enlarged text and forced colors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 960 });
  await page.goto('/app/aethelios');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('Preserve my draft across display preferences.');
  await input.focus();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(input).toHaveValue('Preserve my draft across display preferences.');
  await expect(page.locator('.aurelius-composer')).toHaveCSS('background-image', 'none');
  await expect(input).toBeInViewport();
});

test('public to workspace navigation keeps one shell and isolated public card styles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.company-arrival-actions a[href="/app/work"]').click();
  await expect(page).toHaveURL('/app/work');
  await expect(page.locator('.app-shell')).toHaveCSS('display', 'block');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('link', { name: 'Talk', exact: true }).click();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Aethelios destinations' })
    .getByRole('link', { name: 'Studio', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Make the vision visible.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 720, 1440]) {
  test(`Supporting account and ecosystem tools retain graphite surfaces at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      '/app/grooming',
      '/app/performance',
      '/app/collection',
      '/app/membership',
      '/experience/world',
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('.workspace-loading')).toHaveCount(0);
      if (route === '/experience/world') await expect(page.locator('.gent-world')).toBeVisible();
      await page.screenshot({
        path: `test-results/obsidian-support-${route.replaceAll('/', '-')}-${width}.png`,
        fullPage: true,
      });
    }
  });
}
