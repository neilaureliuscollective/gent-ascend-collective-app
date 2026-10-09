import { test, expect } from './fixtures';
for (const width of [360, 820, 1440]) {
  test(`direct account creation and retained recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: Record<string, unknown>[] = [];
    await page.route('**/api/account/auth', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({
          json: {
            authenticated: false,
            ready: true,
            recoveryReady: true,
            google: false,
            siteKey: '',
            captchaRequired: false,
          },
        });
      const body = route.request().postDataJSON();
      requests.push(body);
      return route.fulfill({
        json:
          body.action === 'send'
            ? { sent: true }
            : { error: 'That code was not accepted. Request a new one.' },
        status: body.action === 'send' ? 200 : 400,
      });
    });
    await page.goto('/join');
    await expect(
      page.getByRole('heading', { name: 'Create an account', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Intelligence access requires an eligible beta grant/),
    ).toBeVisible();
    await page.locator('#claim-email').fill('synthetic@example.test');
    await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
    await expect(page.locator('#claim-code')).toBeVisible();
    expect(requests[0]).toMatchObject({
      action: 'send',
      entry: 'account',
      email: 'synthetic@example.test',
    });
    await expect(page.locator('#claim-code')).toBeVisible();
    await page.locator('#claim-code').fill('123456');
    await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
    await expect(page.locator('.gw-account-claim').getByRole('alert')).toContainText(
      'not accepted',
    );
    await expect(page.locator('#claim-code')).toHaveValue('123456');
    await expect(page.locator('#claim-email')).toHaveValue('synthetic@example.test');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/enter?entry=recover');
    await expect(page.getByRole('heading', { name: 'Return with an email code.' })).toBeVisible();
    await page.locator('#claim-email').fill('synthetic@example.test');
    await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
    await expect(page.locator('#claim-code')).toBeVisible();
    expect(requests.at(-1)).toMatchObject({ action: 'send', entry: 'recover' });
    await expect(page.getByRole('link', { name: 'Use my existing password' })).toHaveAttribute(
      'href',
      '/enter',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('closed signup still offers existing-account recovery without claiming AI access', async ({
  page,
}) => {
  await page.route('**/api/account/auth', (route) =>
    route.fulfill({
      json: {
        authenticated: false,
        ready: false,
        recoveryReady: true,
        google: false,
        siteKey: '',
        captchaRequired: false,
      },
    }),
  );
  await page.goto('/join');
  await expect(page.getByRole('link', { name: 'Use an email code', exact: false })).toHaveAttribute(
    'href',
    '/enter?entry=recover',
  );
  await expect(page.getByRole('button', { name: 'Continue with email' })).toHaveCount(0);
});
test('private preview policies stay unpublished until operator review', async ({ request }) => {
  for (const path of ['/privacy', '/terms']) expect((await request.get(path)).status()).toBe(404);
});
