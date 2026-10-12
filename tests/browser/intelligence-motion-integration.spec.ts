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
  await page.screenshot({ path: 'test-results/guiding-studio.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  await expect(page.locator('.studio-main .im-status')).toHaveText('Saved');
});

for (const width of [344, 768, 1440]) {
  test(`response signature is visibly animated at the work location at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('http://127.0.0.1:3102/motion-integration.html');
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic visible response');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const response = page.locator('.assistant-message .im-response');
    await expect(response).toBeInViewport({ ratio: 0.9 });
    await expect(response).toHaveAttribute('data-phase', 'waiting');
    await expect(response.locator('.im-status')).toHaveText('Waiting for response');
    const ribbon = response.locator('.identity-light');
    await expect(response.locator('.im-presence')).toHaveAttribute('data-animate', 'true');
    await expect(ribbon).toHaveCSS('animation-name', 'identity-gather');
    const bounds = await response.locator('.im-presence').boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(100);
    expect(bounds!.height).toBeGreaterThanOrEqual(70);
    await expect(ribbon).toBeVisible();
    const initial = await ribbon.evaluate((node) => getComputedStyle(node).transform);
    await expect
      .poll(() => ribbon.evaluate((node) => getComputedStyle(node).transform))
      .not.toBe(initial);
    await page.screenshot({
      path: `test-results/visible-response-waiting-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Emit response text' }).click();
    await expect(response).toHaveAttribute('data-phase', 'generating');
    await expect(page.locator('.message-markdown')).toContainText('Synthetic response');
    await page.getByRole('button', { name: 'Emit saving event' }).click();
    await expect(response.locator('.im-status')).toHaveText('Saving');
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await expect(response.locator('.im-status')).toHaveText('Saved');
    await expect(ribbon).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('response feedback stays visible and readable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic reduced motion');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const response = page.locator('.assistant-message .im-response');
  await expect(response).toBeInViewport();
  await expect(response.locator('.im-status')).toHaveText('Waiting for response');
  await expect(response.locator('.identity-light')).toHaveCSS('animation-name', 'none');
  await expect(response.locator('.identity-light')).toBeVisible();
});

test('feedback appears before response headers and never requires opening the orb', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html?holdHeaders=1');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic delayed admission');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.conversation-scroll .im-response')).toBeInViewport({ timeout: 1000 });
  await expect(page.locator('.conversation-turn')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Aethelios presence' })).toBeHidden();
  await expect(page.locator('.assistant-message .im-response')).toBeInViewport();
});

test('long replies keep the primary motion visible as the text grows', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://127.0.0.1:3102/motion-integration.html?longReply=1');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic long reply');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect(page.locator('.message-markdown')).toContainText('Synthetic long response');
  const scroll = page.locator('.conversation-scroll');
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollHeight - node.clientHeight))
    .toBeGreaterThan(500);
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(500);
  await expect(page.locator('.assistant-message .im-response')).toBeInViewport({ ratio: 0.9 });
  await page.screenshot({ path: 'test-results/visible-response-long-768.png', fullPage: true });
});
