import { test, expect } from '@playwright/test';

// Keep this synthetic shell suite on its fixture origin in both dedicated and full runs.
test.use({ baseURL: 'http://127.0.0.1:3102', serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/aurelius**', (route) =>
    route.fulfill({
      json: {
        ownerId: 'synthetic-owner',
        conversations: [],
        turns: [],
        memories: [],
        actionProposals: [],
        context: { profile: null, goal: null, memories: [] },
        canChat: true,
        configured: true,
        model: 'synthetic-fixture',
      },
    }),
  );
});
const routes = [
  '/app',
  '/app/aethelios',
  '/app/work',
  '/app/architect',
  '/app/studio',
  '/app/health',
  '/app/lifestyle',
  '/app/ecosystem',
  '/app/membership',
  '/app/you',
  '/app/founder',
  '/',
];
for (const width of [320, 344, 390, 720, 1440]) {
  test(`local shell fixture parity and interaction at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let expected: string[] | undefined;
    for (const route of routes) {
      await page.goto(
        `/global-navigation.html?identity=founder&route=${encodeURIComponent(route)}`,
      );
      const trigger = page.getByRole('button', { name: 'Menu', exact: true });
      await expect(trigger).toBeVisible();
      await trigger.click();
      const menu = page.getByRole('dialog', { name: 'Aethelios menu' });
      await expect(menu).toBeVisible();
      const links = await menu
        .locator('a')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')!));
      expected ??= links;
      expect(links).toEqual(expected);
      await expect(menu.getByRole('link', { name: 'Architect', exact: true })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Founder Office', exact: true })).toHaveCount(1);
      const last = menu.locator('a[href], button:not(:disabled)').last();
      await last.focus();
      await page.keyboard.press('Tab');
      await expect(menu.getByRole('button', { name: 'Close Aethelios menu' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();
      if (route === '/app' || route === '/app/aethelios' || route === '/app/architect') {
        await page.screenshot({
          path: `docs/evidence/global-navigation/after-${route.split('/').at(-1) || 'home'}-${width}.png`,
        });
      }
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
      await expect(trigger).toBeFocused();
      if (['/app', '/app/aethelios', '/app/architect'].includes(route))
        await page.screenshot({
          path: `docs/evidence/global-navigation/after-closed-${route.split('/').at(-1)}-${width}.png`,
        });
      expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}
test('anonymous/member/founder boundaries, draft/scroll, backdrop and resized sheet', async ({
  page,
}) => {
  for (const identity of ['anonymous', 'member', 'founder']) {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(`/global-navigation.html?identity=${identity}&route=/app/work`);
    await page.getByRole('textbox', { name: 'Retained draft' }).fill('Keep this draft');
    await page.evaluate(() => scrollTo(0, 100));
    const trigger = page.getByRole('button', { name: 'Menu', exact: true });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Aethelios menu' });
    await expect(menu.getByRole('link', { name: 'Founder Office' })).toHaveCount(
      identity === 'founder' ? 1 : 0,
    );
    await expect(menu.getByRole('link', { name: 'Developer console' })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 320 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '24px'));
    await menu.getByRole('link', { name: 'Support', exact: true }).scrollIntoViewIfNeeded();
    await expect(menu.getByRole('link', { name: 'Support', exact: true })).toBeInViewport();
    await page.setViewportSize({ width: 720, height: 900 });
    await page.mouse.click(10, 100);
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Retained draft' })).toHaveValue(
      'Keep this draft',
    );
    expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
  }
});
test('Talk keeps New and local Tools separate and retains its real composer draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 344, height: 740 });
  await page.goto('/global-navigation.html?identity=member&route=/app/aethelios');
  const editor = page.getByRole('textbox', { name: 'Message Aethelios', exact: true });
  await editor.fill('Keep my conversation draft');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Tools & context', exact: true });
  // Compact Motion retains New as an explicit local action in Tools.
  await expect(tools.getByRole('button', { name: 'New conversation', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await tools.getByRole('button', { name: 'New conversation', exact: true }).click();
  await expect(editor).toHaveValue('Keep my conversation draft');
  await expect(tools.getByRole('navigation', { name: 'Aethelios destinations' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(editor).toHaveValue('Keep my conversation draft');
  const bounds = await page.getByRole('button', { name: 'Menu', exact: true }).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(344);
});
