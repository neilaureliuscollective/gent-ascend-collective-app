import { test, expect } from './fixtures';

for (const width of [320, 360, 412, 768, 1024, 1440, 2560]) {
  test(`Imperial Steel preserves real entry paths and readable responsive content at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.public-world')).toHaveAttribute('data-material', 'imperial-steel');
    await expect(
      page.getByRole('heading', { name: /Move your world forward/ }),
    ).toBeVisible();
    await expect(page.locator('.imperial-presence')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.imperial-presence canvas')).toHaveCount(0);
    await expect(page.locator('.company-arrival-actions .button')).toHaveAttribute(
      'href',
      '/enter',
    );
    for (const href of ['/app/aethelios', '/app/work', '/app/studio']) {
      await expect(page.locator(`.imperial-workspace[href="${href}"]`)).toBeVisible();
    }
    await expect(page.getByText('Available today:', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.imperial-workspace').first()).toHaveCSS(
      'transition-duration',
      '0s',
    );
    if (width <= 850) {
      const toggle = page.getByRole('button', { name: /Explore/ });
      await toggle.click();
      const navigation = page.getByRole('navigation', { name: 'Public navigation' });
      await expect(navigation.getByRole('link', { name: 'Open Aethelios' })).toHaveAttribute(
        'href',
        '/enter',
      );
      await page.keyboard.press('Escape');
      await expect(navigation).toBeHidden();
      await expect(toggle).toBeFocused();
    } else {
      await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    }
    await page.screenshot({
      path: `test-results/imperial-steel-home-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await page.goto('/enter');
    await expect(page.locator('.public-world')).not.toHaveAttribute(
      'data-material',
      'imperial-steel',
    );
    await page.goto('/app/aethelios');
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
    await expect(page.locator('.imperial-workspace')).toHaveCSS(
      'background-color',
      'rgb(18, 20, 23)',
    );
  });
}

test('homepage remains understandable and navigable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bring the ambition/ })).toBeVisible();
  await page.locator('.company-arrival-actions .button').click();
  await expect(page).toHaveURL(/\/enter$/);
  await context.close();
});
