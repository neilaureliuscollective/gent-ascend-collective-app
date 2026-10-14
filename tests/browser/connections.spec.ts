import { expect, test } from '@playwright/test';

for (const width of [390, 720, 1440]) {
  test(`Connections setup state is readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/?mode=connections');
    await expect(page.getByRole('heading', { name: 'Verified service access.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vercel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Setup required' }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'View setup' }).first().click();
    await expect(page.getByText('Configuration ready')).toBeVisible();
    await expect(page.getByText('Webhook ready')).toBeVisible();
    await expect(page.getByText('Account authorization completed')).toBeVisible();
    await expect(page.getByText('Selected resource verified')).toBeVisible();
    await expect(page.getByText('GITHUB_APP_ID')).toBeVisible();
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

test('Callback failure does not mark a service connected', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto('http://127.0.0.1:3102/?mode=connections-failed');
  await expect(
    page.getByText('Authorization did not complete. Nothing was marked connected.'),
  ).toBeVisible();
  await expect(page.getByText('Connected and verified', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect' }).first()).toBeEnabled();
});

test('Authorization success asks for repository selection before Connected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3102/?mode=connections-select');
  await expect(
    page.getByText(
      'Authorization succeeded. Select the exact repository or project to verify access.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Select repository')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect' }).first()).toBeVisible();
  await expect(page.getByText('Connected and verified', { exact: false })).toHaveCount(0);
});

test('Expired GitHub authorization requires reconnect and does not claim uninstall', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3102/?mode=connections-expired');
  await expect(
    page.getByText('GitHub user authorization was revoked', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect again' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'What Aethelios can do' }).first().click();
  await expect(
    page.getByText('The GitHub App installation remains until you uninstall it on GitHub', {
      exact: false,
    }),
  ).toBeVisible();
});
