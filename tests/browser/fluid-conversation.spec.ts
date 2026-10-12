import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:3102/motion-integration.html';
const input = (page: import('@playwright/test').Page) =>
  page.getByLabel('Message Aethelios', { exact: true });

test('local pending message precedes acceptance; acceptance preserves a newer draft', async ({
  page,
}) => {
  await page.goto(`${fixture}?holdHeaders=1`);
  await input(page).fill('First submitted thought');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(
    page.locator('.conversation-turn').getByText('First submitted thought', { exact: true }),
  ).toBeVisible({ timeout: 1000 });
  await expect(input(page)).toHaveValue('First submitted thought');
  await expect(input(page)).toBeEnabled();
  await input(page).fill('Next thought while waiting');
  await page.waitForTimeout(1900); // Deliberately delayed synthetic headers, not provider latency.
  await expect(input(page)).toHaveValue('Next thought while waiting');
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect(page.locator('.conversation-turn')).toContainText('Synthetic response');
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  await expect(page.locator('.aurelius-notice')).toHaveText('Reply saved.');
  await expect(input(page)).toHaveValue('Next thought while waiting');
  await expect(page.locator('.conversation-turn')).toHaveCount(1);
});
test('acceptance clears only the sent draft and cancellation retains the newer draft', async ({
  page,
}) => {
  await page.goto(fixture);
  await input(page).fill('Accepted thought');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(input(page)).toHaveValue('');
  await input(page).fill('Keep my next draft');
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.talk-presence')).toHaveAttribute('data-phase', 'cancelled');
  await expect(input(page)).toHaveValue('Keep my next draft');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
});
test('rejected submission retains draft and removes the local pending turn', async ({ page }) => {
  await page.goto(`${fixture}?rejectHeaders=1`);
  await input(page).fill('Keep rejected thought');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(input(page)).toHaveValue('Keep rejected thought');
  await expect(page.locator('.conversation-turn')).toHaveCount(0);
  await expect(page.locator('[role="alert"]').first()).toContainText('Synthetic rejection');
});
for (const width of [344, 390, 720, 768, 1440]) {
  test(`bounded multiline input remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(fixture);
    await input(page).fill('Detailed multiline thought\n'.repeat(80));
    const size = await input(page).evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      scroll: el.scrollHeight,
      client: el.clientHeight,
    }));
    expect(size.height).toBeLessThanOrEqual(201);
    expect(size.scroll).toBeGreaterThan(size.client);
    await input(page).focus();
    await page.setViewportSize({ width, height: 420 });
    await expect(input(page)).toBeFocused();
    expect(
      await input(page).evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(102);
    await page.setViewportSize({ width, height: 844 });
    await expect(input(page)).toHaveValue('Detailed multiline thought\n'.repeat(80));
    await page.screenshot({ path: `test-results/fluid-composer-${width}.png`, fullPage: true });
  });
}
test('desktop Enter submits, Shift+Enter stays multiline, and Ctrl+Enter submits', async ({
  page,
}) => {
  await page.goto(fixture);
  await input(page).fill('Desktop first line');
  await input(page).press('Shift+Enter');
  await expect(input(page)).toHaveValue('Desktop first line\n');
  await input(page).press('Control+Enter');
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop reply' }).click();
});
