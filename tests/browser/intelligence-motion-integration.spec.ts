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
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByLabel('Describe what you want to see').fill('Synthetic visual direction');
  await page.getByRole('button', { name: 'Create image' }).click();
  await expect(page.locator('.studio-main .im-status')).toHaveText('Preparing a reply');
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
    await expect(response.locator('.im-status')).toHaveText('Preparing a reply');
    const filament = response.locator('.im-filament');
    await expect(response.locator('.im-presence')).toHaveAttribute('data-animate', 'true');
    await expect(filament).toHaveCSS('animation-name', 'im-gather');
    const bounds = await response.locator('.im-presence').boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(88);
    expect(bounds!.width).toBeLessThanOrEqual(140);
    expect(bounds!.height).toBeGreaterThanOrEqual(32);
    expect(bounds!.height).toBeLessThanOrEqual(52);
    const emblem = await response.locator('.im-emblem').boundingBox();
    expect(emblem!.width).toBeGreaterThanOrEqual(22);
    expect(emblem!.width).toBeLessThanOrEqual(28);
    await expect(filament).toBeVisible();
    const initial = await filament.evaluate((node) => getComputedStyle(node).transform);
    await expect
      .poll(() => filament.evaluate((node) => getComputedStyle(node).transform))
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
    await expect(filament).toHaveCSS('animation-name', 'none');
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
  await expect(response.locator('.im-status')).toHaveText('Preparing a reply');
  await expect(response.locator('.im-filament')).toHaveCSS('animation-name', 'none');
  await expect(response.locator('.im-emblem')).toBeVisible();
});

test('feedback appears before response headers and never requires opening the orb', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html?holdHeaders=1');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic delayed admission');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.conversation-scroll .im-response')).toBeInViewport({ timeout: 1000 });
  // Local pending submission is visible before acceptance; neither text nor save is invented.
  await expect(page.locator('.assistant-message .im-response')).toHaveAttribute(
    'data-phase',
    'sending',
  );
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Sending');
  await expect(page.locator('.conversation-turn')).toHaveCount(1);
  await expect(page.locator('.user-message')).toContainText('Synthetic delayed admission');
  await expect(page.locator('.message-markdown')).toBeEmpty();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
    'Synthetic delayed admission',
  );
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
  const responseBox = await page.locator('.assistant-message .im-response').boundingBox();
  expect(responseBox!.height).toBeLessThan(56);
  await expect(page.locator('.message-markdown')).toContainText('Synthetic long response');
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await page.screenshot({ path: 'test-results/visible-response-long-768.png', fullPage: true });
});

test('image artifact events move activity onto a placeholder that is not Ready', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic image request');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit image artifact' }).click();
  const card = page.locator('.talk-creation-card[data-in-flight][data-kind="image"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Creating an image');
  await expect(card).not.toHaveAttribute('data-ready', '');
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Creating an image');
});

test('confirmed Saved settles to the compact author mark and late search cannot revive it', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic settle');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await page.getByRole('button', { name: 'Emit saving event' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Saving');
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  const response = page.locator('.assistant-message .im-response');
  await expect(response).toHaveAttribute('data-phase', 'complete');
  await expect(response.locator('.im-status')).toHaveText('Saved');
  await expect(response.locator('.im-living')).toHaveAttribute('data-mode', 'rest');
  const box = await response.boundingBox();
  expect(box!.height).toBeLessThan(56);
  await page.getByRole('button', { name: 'Emit search event' }).click();
  await expect(response).toHaveAttribute('data-phase', 'complete');
});

test('Stop shows Stopping then Stopped without clearing the draft', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Keep stopping draft');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.talk-presence')).toHaveAttribute('data-phase', 'cancelled');
  await expect(page.locator('.assistant-message .im-status')).toHaveText(
    'Stopped · Save unconfirmed',
  );
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
    'Keep stopping draft',
  );
});

test('synthetic voice envelope follows measured CSS level, not a waveform', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Surface', { exact: true }).selectOption('voice');
  await page.getByLabel('Voice phase', { exact: true }).selectOption('listening');
  const filament = page.locator('.im-living-voice-compact .im-filament');
  await expect(filament).toBeVisible();
  const silent = await filament.evaluate((node) => getComputedStyle(node).transform);
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.8');
  await expect
    .poll(() => filament.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(silent);
});

test('Fold-like keyboard height keeps composer, Stop and compact status usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 690, height: 420 });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic fold keyboard');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await expect(page.locator('.assistant-message .im-response')).toBeVisible();
  const response = await page.locator('.assistant-message .im-response').boundingBox();
  const composer = await page.locator('.aurelius-composer').boundingBox();
  expect(response!.height).toBeLessThan(56);
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(421);
});
