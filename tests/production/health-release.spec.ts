import { expect, test } from '@playwright/test';

test('live Health routes disclose no private data to a signed-out visitor', async ({
  request,
  page,
}) => {
  for (const suffix of ['', '/history', '/records', '/labs', '/connections', '/privacy']) {
    const response = await request.get(`/app/health${suffix}`);
    expect(response.status(), suffix).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(await response.text()).toContain('noindex');
  }
  for (const [path, status] of [
    ['/api/health', 401],
    ['/api/health/records/00000000-0000-4000-8000-000000000000', 404],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(status);
    expect(response.headers()['cache-control']).toContain('no-store');
    const body = await response.json();
    expect(Object.keys(body)).toEqual(['error']);
    if (status === 404) expect(body).toEqual({ error: 'Private record not found.' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/health');
  await expect(
    page.getByRole('heading', { name: 'A clearer understanding of you.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Begin with your own information.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Health', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: 'test-results/health-live-signed-out-390.png', fullPage: true });
  expect((await request.get('/dev', { maxRedirects: 0 })).status()).toBe(404);
});
