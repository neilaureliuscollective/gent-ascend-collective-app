import { test, expect } from './fixtures';

test('the public living orb serves the member conversation without requesting audio', async ({
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
  const presence = page.getByRole('button', { name: 'Aethelios presence', exact: true });
  await expect(presence).toBeVisible();
  await presence.click();
  await expect(page.getByText('Your conversation stays in place. Microphone off.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Message Aethelios').fill('My unsent thought');
  expect(writes).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`Aethelios room keeps the orb, conversation and writing space usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/app/aethelios');
    await expect(
      page.getByRole('button', { name: 'Aethelios presence', exact: true }),
    ).toBeInViewport();
    await page.getByRole('button', { name: 'Expand writing space' }).click();
    const composer = page.getByLabel('Expanded message');
    await composer.fill('A detailed thought\n'.repeat(18));
    await expect(composer).toBeInViewport();
    await page
      .getByRole('dialog', { name: 'Expanded writing space' })
      .getByRole('button', { name: 'Done', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeInViewport();
    const room = await page.locator('.aethelios-page').boundingBox();
    expect(room!.height).toBeGreaterThan(850);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('unsupported WebGL preserves the static public orb and the composer', async ({ page }) => {
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
  await expect(page.locator('.talk-presence > .talk-tool .intelligence-orb-static')).toBeVisible();
  await page.getByLabel('Message Aethelios').fill('Still usable without graphics');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Still usable without graphics');
});
