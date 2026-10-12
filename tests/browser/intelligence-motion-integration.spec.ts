import { test, expect } from '@playwright/test';
for (const width of [344, 768, 1440]) {
  test(`real Talk reports search and saving only from fixture events at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/motion-integration.html');
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic request');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const mark = page.locator('.talk-presence');
    await expect(mark).toHaveAttribute('data-phase', 'waiting');
    await page.getByRole('button', { name: 'Emit search event' }).click();
    await expect(mark).toHaveAttribute('data-phase', 'searching');
    await page.screenshot({ path: `test-results/motion-search-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Emit response text' }).click();
    // Search remains current until the server signals its end; text alone cannot clear it.
    await expect(mark).toHaveAttribute('data-phase', 'searching');
    await page.getByRole('button', { name: 'Emit saving event' }).click();
    await expect(mark).toHaveAttribute('data-phase', 'saving');
    await expect(page.locator('.aurelius-notice')).not.toHaveText('Reply saved.');
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await expect(mark).toHaveAttribute('data-phase', 'complete');
    await expect(page.locator('.aurelius-notice')).toHaveText('Reply saved.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('Stop preserves the draft and reports cancellation independently of failure', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Keep this draft');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.talk-presence')).toHaveAttribute('data-phase', 'cancelled');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
    'Keep this draft',
  );
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
});
test('Studio uses waiting until its synchronous endpoint confirms the save', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Surface', { exact: true }).selectOption('studio');
  await page.getByLabel('Describe what you want to see').fill('Synthetic visual direction');
  await page.getByRole('button', { name: 'Create image' }).click();
  await expect(page.locator('.studio-main .im-status')).toHaveText('Waiting for response');
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  await expect(page.locator('.studio-main .im-status')).toHaveText('Saved');
});
