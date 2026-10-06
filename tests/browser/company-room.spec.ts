import { test, expect } from './fixtures';
const companyId = 'c8000000-0000-4000-8000-000000000001';
for (const width of [360, 768, 1440]) {
  test(`company room keeps drafts and specialist requests scoped at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: unknown[] = [];
    await page.route('**/api/company-talk/chat', async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic model unavailable' }),
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=company-room');
    await expect(page.getByRole('heading', { name: 'Synthetic A', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sharpen the positioning' }).click();
    await expect(page.getByLabel('Work with Synthetic A')).toHaveValue(/positioning/);
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Company tools', exact: true }).click();
    await page.getByLabel('Bring in a specialist').selectOption('athena');
    await page.getByRole('button', { name: 'Close Company tools', exact: true }).click();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Synthetic model unavailable');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      companyId,
      council: { kind: 'specialist', specialists: ['athena'] },
    });
    expect(requests[0]).not.toHaveProperty('includeContext');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('company brief writes require explicit confirmation and a current version', async ({
  page,
}) => {
  let body: unknown;
  await page.route('**/api/companies', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'The brief changed. Reload before editing again.' }),
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=company-room');
  await page.getByRole('button', { name: 'Company tools', exact: true }).click();
  await page.getByRole('button', { name: 'Review brief · v1' }).click();
  await page.getByLabel('Confirmed business context').fill('A proposed correction');
  expect(body).toBeUndefined();
  await page.getByRole('button', { name: 'Confirm and save' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'The brief changed. Reload before editing again.',
  );
  expect(body).toMatchObject({ id: companyId, version: 1, brief: 'A proposed correction' });
  await expect(page.getByLabel('Confirmed business context')).toHaveValue('A proposed correction');
});
