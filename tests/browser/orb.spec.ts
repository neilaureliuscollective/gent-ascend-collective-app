import { test, expect } from './fixtures';

test('the lightweight presence serves the member conversation without requesting audio', async ({
  page,
}) => {
  const writes: string[] = [];
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      throw new Error('Unexpected microphone request');
    };
  });
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) writes.push(request.url());
  });
  await page.goto('/app/aethelios');
  const orb = page.locator('.talk-welcome-presence');
  await expect(orb.locator('.identity-presence')).toBeVisible();
  await expect(orb).toHaveAttribute('data-state', 'disconnected');
  await page.getByRole('button', { name: 'Aethelios presence', exact: true }).click();
  const presence = page.getByRole('dialog', { name: 'Aethelios presence', exact: true });
  await expect(presence.getByText('Connect to begin', { exact: true })).toBeVisible();
  await expect(
    presence.getByText('Your conversation stays in place. Microphone off.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(presence).not.toBeVisible();
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Tools & context', exact: true })
    .getByRole('button', { name: 'Pause ambient motion' })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await expect(orb.locator('.identity-presence')).toBeVisible();
  await expect(orb.locator('canvas')).toHaveCount(0);
  await expect(orb.locator('.identity-presence')).toHaveAttribute('data-motion', 'still');
  await page.getByLabel('Message Aethelios').fill('My unsent thought');
  expect(writes).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`Aethelios room keeps the presence, conversation and writing space usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/app/aethelios');
    await expect(page.locator('.talk-welcome-presence')).toBeInViewport();
    await page.getByRole('button', { name: 'Expand writing space' }).click();
    const composer = page.getByLabel('Message Aethelios');
    await composer.fill('A detailed thought\n'.repeat(18));
    await expect(composer).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeInViewport();
    const room = await page.locator('.aethelios-page').boundingBox();
    expect(room!.height).toBeGreaterThan(850);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('unsupported WebGL preserves the lightweight presence and the composer', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto('/app/aethelios');
  await expect(page.locator('.talk-welcome-presence .identity-presence')).toBeVisible();
  await page.getByLabel('Message Aethelios').fill('Still usable without graphics');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Still usable without graphics');
});

test('retained visual preview changes states without requesting audio or work', async ({
  page,
}) => {
  const writes: string[] = [];
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      throw new Error('Unexpected microphone request');
    };
  });
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) writes.push(request.url());
  });
  await page.goto(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_FIXTURE_PORT || '3102'}/?mode=orb-preview`,
  );
  await page.getByRole('button', { name: 'Explore the Orb' }).click();
  await expect(page.getByText('Motion preview · microphone off · no audio')).toBeVisible();
  const orb = page.locator('.orb-presentation .account-intelligence-orb');
  for (const label of ['Listening', 'Speaking', 'Insight', 'Milestone']) {
    await page
      .getByRole('group', { name: 'Orb motion preview' })
      .getByRole('button', { name: label, exact: true })
      .click();
    await expect(orb).toHaveAttribute('data-state', `preview-${label.toLowerCase()}`);
  }
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.getByText('Still mode · state changes remain visible.')).toBeVisible();
  await expect(orb.locator('.intelligence-orb-static')).toBeVisible();
  expect(writes).toEqual([]);
});
