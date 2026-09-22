import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:3102';
test('profile validation preserves edits, focuses errors and saves a new version', async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel('What should we call you?').fill('');
  await page.getByLabel('What matters most right now?').fill('Keep this draft');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByText('Enter your name.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('What matters most right now?')).toHaveValue('Keep this draft');
  await page.getByLabel('What should we call you?').fill('Aethelios Founder');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await expect(page.locator('input[name="version"]')).toHaveValue('2');
});
test('failed save keeps entered values and a conflict requires reloading', async ({ page }) => {
  for (const outcome of ['error', 'conflict']) {
    await page.goto(`${fixture}/?outcome=${outcome}`);
    await page.getByLabel('What should we call you?').fill('Retain my name');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('What should we call you?')).toHaveValue('Retain my name');
    if (outcome === 'conflict') {
      await expect(page.getByRole('button', { name: 'Save profile' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Reload latest' })).toBeVisible();
    } else await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled();
  }
});
test('goal needs a next step and closing requires a deliberate confirmation', async ({ page }) => {
  await page.goto(`${fixture}/?mode=goal`);
  await page.getByLabel('Your next concrete step').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Choose a concrete next step.', { exact: true })).toBeVisible();
  await page.getByLabel('Your next concrete step').fill('Take one deliberate step.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Goal updated.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByRole('button', { name: 'Confirm completion' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep working' }).click();
  await expect(page.getByRole('button', { name: 'Confirm completion' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Archive goal' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(
    page.getByText('Goal archived. It remains in your history.', { exact: true }),
  ).toBeVisible();
});
for (const width of [360, 768, 1440]) {
  test(`personal forms remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const mode of ['profile', 'goal']) {
      await page.goto(`${fixture}/?mode=${mode}`);
      await expect(
        page.getByRole('heading', {
          name: mode === 'profile' ? 'Your personal profile' : 'Your active goal',
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const field = page.locator('.editor-form input:not([type=hidden])').first();
      await field.focus();
      await expect(field).toBeFocused();
      await page.screenshot({ path: `test-results/${mode}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
