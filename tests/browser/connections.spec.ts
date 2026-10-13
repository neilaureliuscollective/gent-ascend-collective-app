import { expect, test } from '@playwright/test';

for (const width of [390, 720, 1440]) {
  test(`Connections setup state is readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/?mode=connections');
    await expect(page.getByRole('heading', { name: 'Verified service access.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vercel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Setup required' }).first()).toBeDisabled();
    await expect(page.getByText('read-only', { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `docs/evidence/connections/connections-setup-${width}.png`,
      fullPage: true,
    });
  });
}

test('Connections connected cards expose verify, disconnect and capability detail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3102/?mode=connections-connected');
  await expect(
    page.getByText('Connected and verified for neilaureliuscollective/gent-ascend-collective-app.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'What Aethelios can do' }).first().click();
  await expect(
    page.getByText('No administration, secrets, workflows', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify again' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect' }).first()).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/connections/connections-connected-1440.png',
    fullPage: true,
  });
});

test('Connect reveals a permission summary before leaving', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=connections-ready');
  await page.getByRole('button', { name: 'Connect' }).first().click();
  await expect(page.getByRole('heading', { name: 'Before leaving for GitHub' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to GitHub' })).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/connections/connections-permissions-390.png',
    fullPage: true,
  });
});
