import { test, expect } from './fixtures';
import { commandFixture } from '../component-fixture/daily-command';
for (const width of [344, 768, 1440]) {
  test(`Daily Command explains, saves arrival and closes the loop at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let data = structuredClone(commandFixture),
      writes = 0;
    await page.route('**/api/daily-command', async (route) => {
      if (route.request().method() === 'POST') {
        writes++;
        const input = route.request().postDataJSON();
        expect(input.ownerId).toBe(data.ownerId);
        data = {
          ...data,
          arrival: input.arrival ?? data.arrival,
          record: {
            person_id: data.ownerId!,
            day: data.snapshot!.day,
            version: (data.record?.version ?? 0) + 1,
            arrival: input.arrival ?? data.arrival,
            snapshot: data.snapshot!,
            outcome: input.outcome ?? null,
            updated_at: '2026-10-02T15:00:00Z',
          },
        };
      }
      await route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:3102/?mode=command');
    await expect(page.getByRole('heading', { name: 'READY', exact: true })).toBeVisible();
    await expect(page.locator('.command-decisions li')).toHaveCount(3);
    await expect(page.locator('.command-decisions')).not.toContainText('GROOM');
    expect(writes).toBe(0);
    await page.getByText('Why this direction', { exact: true }).click();
    await expect(page.getByText('USER-REPORTED / 2026-10-02', { exact: true })).toBeVisible();
    await page.getByText('Talk to Aethelios about this day', { exact: true }).click();
    await expect(page.getByRole('link', { name: 'Review my day with Aethelios' })).toHaveAttribute(
      'href',
      '/app/aethelios?starter=command',
    );
    await page.getByText('Morning arrival · optional', { exact: true }).click();
    await page.getByLabel('Energy · 1 very low to 5 high').fill('3');
    await page.getByLabel('Soreness', { exact: true }).selectOption('mild');
    await page.getByRole('button', { name: 'Save arrival & command' }).click();
    await expect(page.getByRole('status')).toContainText('arrival and command are saved');
    await page.getByText('Close the loop', { exact: true }).click();
    await page.getByLabel('Did the direction fit?').selectOption('too-much');
    await page.getByLabel('What should tomorrow know?').fill('Keep tomorrow smaller.');
    await page.getByRole('button', { name: 'Save evening feedback' }).click();
    await expect(page.getByRole('status')).toContainText('feedback is saved for tomorrow');
    expect(data.record?.outcome?.fit).toBe('too-much');
    expect(writes).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/command-${width}.png`, fullPage: true });
  });
}
test('Daily Command retains a conflicting draft and requires reload', async ({ page }) => {
  await page.route('**/api/daily-command', (route) =>
    route.fulfill({ status: 409, json: { error: 'The command changed. Reload before saving.' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=command');
  await page.getByText('Morning arrival · optional', { exact: true }).click();
  await page.getByLabel('Sleep · minutes').fill('330');
  await page.getByRole('button', { name: 'Save arrival & command' }).click();
  await expect(page.getByRole('alert')).toContainText('command changed');
  await expect(page.getByLabel('Sleep · minutes')).toHaveValue('330');
  await expect(page.getByRole('button', { name: 'Save arrival & command' })).toBeDisabled();
});
test('Daily Command API remains private and denies hostile origins', async ({ request }) => {
  const result = await request.get('/api/daily-command');
  expect(result.status()).toBe(401);
  const denied = await request.post('/api/daily-command', {
    headers: { origin: 'https://hostile.example' },
    data: {},
  });
  expect(denied.status()).toBe(403);
  expect(result.headers()['cache-control']).toContain('no-store');
});
