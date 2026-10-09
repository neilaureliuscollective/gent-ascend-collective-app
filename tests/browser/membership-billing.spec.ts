import { componentUrl } from './fixtures';
import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`membership account stays private and honest at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/membership?checkout=returned');
    await expect(page.getByRole('heading', { name: 'Your founding chapter.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in →', exact: true })).toBeVisible();
    await expect(page.getByText('Paid access confirmed.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /checkout|billing/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/membership-account-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Sign in →', exact: true }).click();
    await expect(page).toHaveURL(/\/join/);
    await expect(
      page.getByText('Account entry is being prepared.', { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/membership-join-${width}.png`, fullPage: true });
  });
}
test('recurring consent is required, failed checkout preserves the chosen plan, and unsafe redirects are rejected', async ({
  page,
}) => {
  await page.setViewportSize({ width: 344, height: 900 });
  let calls = 0;
  let payload: unknown;
  await page.route('**/api/billing', async (route) => {
    calls++;
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: calls === 1 ? 503 : 200,
      json:
        calls === 1
          ? { error: 'Checkout temporarily unavailable.' }
          : { url: 'https://attacker.example/pay' },
    });
  });
  await page.goto(componentUrl('/?mode=membership'));
  await page.getByLabel('Your founding level').selectOption('signature');
  await page.getByRole('button', { name: 'Continue to secure checkout ↗' }).click();
  expect(calls).toBe(0);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to secure checkout ↗' }).click();
  await expect(page.getByRole('status')).toHaveText('Checkout temporarily unavailable.');
  await expect(page.getByLabel('Your founding level')).toHaveValue('signature');
  expect(payload).toEqual({
    action: 'checkout',
    tier: 'signature',
    consent: true,
    termsVersion: 'fixture-v1',
  });
  await page.getByRole('button', { name: 'Continue to secure checkout ↗' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(
    'The payment destination could not be verified.',
  );
  await expect(page).toHaveURL(componentUrl('/?mode=membership'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/membership-controls-344.png', fullPage: true });
});
test('turning off enrollment keeps billing management and refresh available', async ({ page }) => {
  await page.route('**/api/billing', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ action: 'refresh' });
    await route.fulfill({ json: { refreshed: true } });
  });
  await page.goto(componentUrl('/?mode=membership&enrollment=closed&customer=yes'));
  await expect(page.getByRole('button', { name: 'Continue to secure checkout ↗' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage billing securely ↗' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh payment status' }).click();
  await expect(page.getByRole('status')).toHaveText('Your billing status has been refreshed.');
});

test('founder readiness is explicit, preserves unknown acceptance and recovers from failure', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/billing/readiness', async (route) => {
    calls++;
    await route.fulfill({
      status: calls === 1 ? 503 : 200,
      json:
        calls === 1
          ? { error: 'Readiness could not be checked.' }
          : {
              checkedAt: '2026-10-04T22:00:00.000Z',
              checks: [
                {
                  name: 'Membership prices',
                  status: 'verified',
                  detail: 'Configured prices match.',
                },
                {
                  name: 'Real subscription lifecycle',
                  status: 'unknown',
                  detail: 'Actual payment acceptance remains open.',
                },
              ],
            },
    });
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(componentUrl('/?mode=membership&enrollment=closed&founder-audit=yes'));
  expect(calls).toBe(0);
  await page.getByText('Founder / Revenue readiness', { exact: true }).click();
  await page.getByRole('button', { name: 'Check billing readiness' }).click();
  await expect(page.getByRole('status')).toHaveText('Readiness could not be checked.');
  await page.getByRole('button', { name: 'Check billing readiness' }).click();
  await expect(
    page.getByText('Real subscription lifecycle — unknown', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to secure checkout ↗' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
