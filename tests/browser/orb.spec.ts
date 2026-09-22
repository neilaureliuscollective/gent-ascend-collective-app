import { test, expect } from '@playwright/test';

test('Orb preview is illustrative, keyboard usable, and never requests audio or sends data', async ({
  page,
}) => {
  const writes: string[] = [];
  const errors: string[] = [];
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      throw new Error('Unexpected microphone request');
    };
  });
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) writes.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto('/aethelios');
  const orb = page.locator('.orb-presentation .aurelius-presence');
  await expect(orb).toHaveAttribute('data-state', 'disconnected');
  await page.getByRole('button', { name: 'Explore the Orb' }).click();
  await expect(page.getByText('Motion preview · microphone off · no audio')).toBeVisible();
  const controls = page.getByRole('group', { name: 'Orb motion preview' });
  await controls.getByRole('button', { name: 'Listening', exact: true }).click();
  await expect(orb).toHaveAttribute('data-state', 'preview-listening');
  await expect(orb).toHaveAttribute('data-preview', 'true');
  await controls.getByRole('button', { name: 'Speaking', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(orb).toHaveAttribute('data-state', 'preview-speaking');
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await expect(page.getByText('Still mode · state changes remain visible.')).toBeVisible();
  await expect(orb.locator('.presence-fallback')).toBeVisible();
  await controls.getByRole('button', { name: 'Stopped', exact: true }).click();
  await expect(orb).toHaveAttribute('data-state', 'stopped');
  await page.getByRole('button', { name: 'Close Orb preview' }).click();
  await expect(orb).toHaveAttribute('data-state', 'disconnected');
  await page.getByLabel('Message Aethelios').fill('My unsent thought');
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('enhanced Orb renders, pauses for focus and dialogs, handles context loss, and disposes', async ({
  page,
}) => {
  await page.goto('/aethelios');
  const orb = page.locator('.orb-presentation .aurelius-presence');
  await expect(orb).toHaveAttribute('data-rendered', 'true', { timeout: 15000 });
  await expect(page.locator('.presence-canvas')).toHaveCount(1);
  await expect(orb).toHaveAttribute('data-animating', 'true');
  await page.getByLabel('Message Aethelios').focus();
  await expect(orb).toHaveAttribute('data-animating', 'false');
  await page.getByRole('button', { name: 'Explore the Orb' }).click();
  await expect(orb).toHaveAttribute('data-animating', 'true');
  await page
    .getByRole('group', { name: 'Orb motion preview' })
    .getByRole('button', { name: 'Stopped', exact: true })
    .click();
  await expect(orb).toHaveAttribute('data-animating', 'false');
  await page
    .getByRole('group', { name: 'Orb motion preview' })
    .getByRole('button', { name: 'Thinking', exact: true })
    .click();
  await expect(orb).toHaveAttribute('data-animating', 'true');
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'orb-test-dialog';
    document.body.append(dialog);
    dialog.showModal();
  });
  await expect(orb).toHaveAttribute('data-animating', 'false');
  await page.evaluate(() =>
    (document.querySelector('#orb-test-dialog') as HTMLDialogElement).close(),
  );
  await expect(orb).toHaveAttribute('data-animating', 'true');
  await orb.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(orb).toHaveAttribute('data-rendered', 'false');
  await expect(orb.locator('.presence-fallback')).toBeVisible();
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable ambient motion' }).click();
  await expect(orb).toHaveAttribute('data-rendered', 'true', { timeout: 15000 });
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
});

for (const width of [390, 768, 1440]) {
  test(`Orb preview keeps controls and composition usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/aethelios');
    await page.getByRole('button', { name: 'Explore the Orb' }).click();
    await page
      .getByRole('group', { name: 'Orb motion preview' })
      .getByRole('button', { name: 'Speaking', exact: true })
      .click();
    await expect(page.getByLabel('Message Aethelios')).toBeInViewport();
    expect(
      await page
        .locator('.orb-preview-controls')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await page
        .locator('.welcome-heading')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.presence-canvas')).toHaveCount(0);
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.getByRole('button', { name: 'Close Orb preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Orb preview' }).click();
  });
}

// Accelerate only the RAF clock to exercise the sustained-frame-budget fallback.
test('sustained slow frames fall back to the static Orb without blocking the composer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => original((time) => callback(time * 4));
  });
  await page.goto('/aethelios');
  const orb = page.locator('.orb-presentation .aurelius-presence');
  await expect(orb).toHaveAttribute('data-fallback', 'frame-budget', { timeout: 20000 });
  await expect(orb).toHaveAttribute('data-rendered', 'false');
  await expect(orb.locator('.presence-fallback')).toBeVisible();
  await expect(orb.locator('canvas')).toBeHidden();
  await page.getByLabel('Message Aethelios').fill('Still responsive');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Still responsive');
});
