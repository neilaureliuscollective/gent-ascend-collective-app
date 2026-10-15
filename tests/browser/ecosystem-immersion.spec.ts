import { expect, test } from './fixtures';

test('Ecosystem opening, example, fit and closed next step stay truthful', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/ecosystem');
  await expect(page.getByRole('heading', { name: /One world/ })).toBeVisible();
  await expect(page.getByText('Illustrative preview. No live provider work is running.')).toBeVisible();
  await page.getByRole('radio', { name: 'Build a useful tool' }).check();
  await expect(page.getByRole('heading', { name: 'Harbor Ledger' })).toBeVisible();
  await page.getByPlaceholder('A quiet estimator for materials, time and cost.').fill(
    'Estimate cedar and brass for a small cabinet.',
  );
  await expect(
    page.getByText('Estimate cedar and brass for a small cabinet.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in to open Talk/ })).toHaveAttribute(
    'href',
    '/enter',
  );
  await page.getByRole('radio', { name: 'I want to make reusable work' }).check();
  await page.getByRole('radio', { name: 'As a regular part of my work' }).check();
  await expect(page.locator('.eco-recommend h3')).toContainText('Create');
  await expect(page.locator('.eco-recommend h3')).toContainText('$59.00');
  await expect(page.getByText('least expensive membership', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Select Continuum' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Continuum is coming soon' })).toBeVisible();
  await expect(page.getByRole('link', { name: /checkout|subscribe|buy/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /buy|subscribe|checkout/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Select Access' }).first().click();
  await expect(page.getByRole('link', { name: 'Sign in if you already have access' })).toHaveAttribute(
    'href',
    '/enter?from=ecosystem&intent=tool&plan=access',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Ecosystem restores a previous selection and keeps Continuum away from purchase', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/ecosystem?intent=project&plan=continuum&goal=coordinate&cadence=ongoing');
  await expect(page.getByRole('heading', { name: 'Northline Initiative' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Continuum is coming soon' })).toBeVisible();
  await expect(page.getByText('Available alternative while Continuum is coming soon')).toBeVisible();
  await page.goto('/join?from=ecosystem&plan=continuum');
  await expect(page.getByText('Aethelios / Your account')).toBeVisible();
  await expect(page.getByText('Public account registration is not open yet.')).toBeVisible();
  await expect(page.getByText('You arrived from Ecosystem with Continuum selected')).toBeVisible();
  await page.goto('/ecosystem?intent=brand');
  await expect(page.getByRole('heading', { name: 'Lumen Atelier' })).toBeVisible();
  await page.getByRole('button', { name: /Explore/ }).click();
  await expect(
    page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Ecosystem' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [344, 720, 1440]) {
  test(`Ecosystem membership presentation stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/ecosystem');
    await expect(page.locator('.eco-chamber')).toHaveCount(5);
    await expect(page.locator('.eco-chamber-continuum')).toContainText('Coming soon');
    await expect(page.locator('.eco-chamber-architect')).toContainText('$129.00');
    await expect(page.getByRole('heading', { name: 'Aethelios Health' })).toBeVisible();
    await expect(
      page.getByText('No prescribing or clinical care is offered here.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('Physical products are separate purchases', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Your membership ↗', exact: true })).toHaveAttribute(
      'href',
      '/app/membership',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/ecosystem-immersion-${width}.png`,
      fullPage: true,
    });
  });
}
