import { test, expect } from './fixtures';
const fixture = 'http://127.0.0.1:3102/?mode=performance';
for (const width of [360, 375, 390, 412, 430, 768, 1440])
  test(`direction sheet fits ${width} and retains edits`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Edit direction', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Your direction', exact: true });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Your practice', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Adjust direction', exact: true }).click();
    await sheet.getByLabel('Movements or limitations to account for').fill('Keep my draft');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit direction', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Edit direction', exact: true }).click();
    await expect(sheet.getByLabel('Movements or limitations to account for')).toHaveValue(
      'Keep my draft',
    );
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390) await page.screenshot({ path: '/tmp/performance-interaction-390.png' });
  });
test('keeping the existing direction performs no write', async ({ page }) => {
  let writes = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/performance')) writes++;
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Edit direction', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this direction' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(writes).toBe(0);
});
test('world directory includes both deep worlds and compact global navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/app/world');
  const worlds = page.getByRole('navigation', { name: 'Your worlds' });
  await expect(worlds.getByRole('link', { name: /Ascend Performance/ })).toHaveAttribute(
    'href',
    '/app/performance',
  );
  await expect(worlds.getByRole('link', { name: /Grooming Concierge/ })).toHaveAttribute(
    'href',
    '/app/grooming',
  );
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  const tops = await nav
    .getByRole('link')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
