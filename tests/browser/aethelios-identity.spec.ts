import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`Aethelios introduction, portrait, and conversation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/app/aethelios/meet');
    await expect(page).toHaveTitle('Meet Aethelios · Gent Ascend');
    await expect(page.getByRole('heading', { name: /The mission.*Made present/ })).toBeVisible();
    await expect(page.locator('body')).toContainText('The founder remains the human source.');
    await expect(page.locator('body')).not.toContainText('Aurelius');
    await expect(page.locator('.aethelios-portrait img')).toBeVisible();
    expect(
      await page
        .locator('.aethelios-portrait img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/aethelios-introduction-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Talk with Aethelios' }).click();
    await expect(page).toHaveURL(/\/aethelios$/);
    await expect(page.getByLabel('Message Aethelios')).toBeVisible();
    await expect(page.getByText('Aethelios · Digital Co-Founder')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Aurelius');
    await page.getByRole('button', { name: 'Explore the Orb' }).click();
    for (const label of ['Insight', 'Milestone']) {
      await page
        .getByRole('group', { name: 'Orb motion preview' })
        .getByRole('button', { name: label, exact: true })
        .click();
      await expect(page.locator('.orb-presentation .aurelius-presence')).toHaveAttribute(
        'data-state',
        `preview-${label.toLowerCase()}`,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.orb-presentation .aurelius-presence')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/aethelios-orb-${width}.png`, fullPage: true });
  });
}

test('previous conversation bookmarks retain their conversation and starter query', async ({
  page,
}) => {
  const query = '?conversation=30000000-0000-4000-8000-000000000001&starter=reflect';
  await page.goto('/app/aurelius' + query);
  await expect(page).toHaveURL('/app/aethelios' + query);
  await expect(page.getByRole('heading', { name: 'Aethelios.', exact: true })).toBeVisible();
});

test('introduction link closes the global panel even when already on the introduction', async ({
  page,
}) => {
  await page.goto('/app/aethelios/meet');
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Meet Aethelios' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL('/app/aethelios/meet');
  await expect(page.getByRole('heading', { name: /The mission.*Made present/ })).toBeVisible();
});
