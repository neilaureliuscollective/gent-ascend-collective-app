import { test, expect } from '@playwright/test';

test('motion and solid-surface choices persist; OS reduced motion always wins', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await page.getByRole('button', { name: 'Use solid surfaces' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await expect(page.locator('.navigation')).toHaveCSS('backdrop-filter', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Enable ambient motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Message Aethelios').fill('A quiet place to think');
  await expect(page.locator('html')).toHaveAttribute('data-quiet', 'true');
});

test('unsupported WebGL preserves the static presence and usable navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/aethelios');
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  // Exercise the deferred renderer failure in the conversation welcome.
  await page.waitForTimeout(1600);
  await expect(page.locator('.welcome-heading .presence-fallback')).toBeVisible();
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await page.getByLabel('Message Aethelios').fill('Still usable without graphics');
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 740 },
  { width: 1024, height: 768 },
]) {
  test(`short-screen workspace stays usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/aethelios');
    await expect(page.getByLabel('Message Aethelios')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(page.getByText('Preview · no personal data loaded')).toBeVisible();
  });
}

test('200 percent text remains navigable and permits reading and composing', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 960 });
  await page.goto('/aethelios');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Message Aethelios').fill('Larger text');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Larger text');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.getByText('Preview · sign in to confirm and save memories.')).toBeVisible();
});

test('connected light follows navigation and becomes still while reading a dialog', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.connection-field')).toHaveAttribute('data-section', '/');
  await expect(page.locator('.connection-selected')).toHaveCount(1);
  await expect(page.locator('.connection-arrival')).toHaveCSS('animation-iteration-count', '1');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('link', { name: 'My world' }).click();
  await expect(page.locator('.connection-field')).toHaveAttribute('data-section', '/world');
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-quiet', 'true');
  await expect(page.locator('.ambient-light')).toHaveCSS('animation-play-state', 'paused');
  await expect(page.locator('.connection-arrival')).toHaveCSS('animation-play-state', 'paused');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-quiet', 'false');
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.locator('.connection-arrival')).toBeHidden();
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('.connection-field')).toBeHidden();
  await expect(navigation.getByRole('link', { name: 'My world' })).toBeVisible();
});
