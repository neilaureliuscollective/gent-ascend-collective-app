import { test, expect } from './fixtures';
const ownerId = '60000000-0000-4000-8000-000000000001';
const syntheticWorkspace = {
  ownerId,
  conversations: [],
  turns: [],
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic tester',
      priority: '',
      timezone: 'America/Chicago',
      units: 'metric',
      updatedAt: '2026-09-21',
    },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-model',
};
for (const [width, height] of [
  [344, 740],
  [390, 844],
  [360, 640],
  [768, 900],
  [1440, 900],
] as const) {
  test(`direct home utility and world access at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:3102/?mode=home-handoff');
    await expect(
      page.getByRole('heading', { name: 'Good morning, Synthetic tester.' }),
    ).toBeVisible();
    const composer = page.getByRole('textbox', { name: 'What are we working on?' });
    await expect(composer).toBeVisible();
    const box = await composer.boundingBox();
    expect(box!.y + box!.height).toBeLessThan(height - 90);
    await expect(page.locator('.command-opening')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Replay arrival' })).toHaveCount(0);
    await expect(
      page
        .getByRole('navigation', { name: 'Your operating spaces' })
        .getByRole('link', { name: /Ascend Collection/ }),
    ).toHaveAttribute('href', '/app/collection');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/direct-home-${width}.png`, fullPage: true });
  });
}
test('home draft opens existing Talk with no automatic send or browser persistence', async ({
  page,
}) => {
  const posts: string[] = [];
  await page.route('**/api/aurelius**', async (route) => {
    if (route.request().method() !== 'GET') posts.push(route.request().url());
    await route.fulfill({ json: syntheticWorkspace });
  });
  await page.goto('http://127.0.0.1:3102/?mode=home-handoff');
  await page
    .getByRole('textbox', { name: 'What are we working on?' })
    .fill('Help me plan my grooming ritual and next training session.');
  await page.getByRole('button', { name: 'Continue in Talk' }).click();
  await expect(page.locator('.aurelius-composer textarea')).toHaveValue(
    'Help me plan my grooming ritual and next training session.',
  );
  expect(posts).toEqual([]);
  expect(page.url()).not.toContain('Help');
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
        String(value).includes('grooming ritual'),
      ),
    ),
  ).toBe(false);
});
for (const changed of [true, false])
  test(`private handoff clears on ${changed ? 'account change' : 'expired session'}`, async ({
    page,
  }) => {
    await page.route('**/api/aurelius**', (route) =>
      route.fulfill(
        changed
          ? { json: { ...syntheticWorkspace, ownerId: 'different-owner' } }
          : { status: 401, json: { error: 'Sign in' } },
      ),
    );
    await page.goto('http://127.0.0.1:3102/?mode=home-handoff');
    await page
      .getByRole('textbox', { name: 'What are we working on?' })
      .fill('Private synthetic thought');
    await page.getByRole('button', { name: 'Continue in Talk' }).click();
    await expect(page.locator('.aurelius-composer textarea')).toHaveValue('');
  });

test('phone composer stays reachable when the viewport shortens for a keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=home-handoff');
  await page
    .getByRole('textbox', { name: 'What are we working on?' })
    .fill('A synthetic keyboard draft');
  await page.setViewportSize({ width: 390, height: 440 });
  const continueButton = page.getByRole('button', { name: 'Continue in Talk' });
  await expect
    .poll(async () => {
      const box = await continueButton.boundingBox();
      const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
      return box!.y + box!.height - nav!.y;
    })
    .toBeLessThanOrEqual(0);
  expect((await continueButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('textbox', { name: 'What are we working on?' })).toHaveValue(
    'A synthetic keyboard draft',
  );
});
test('member home retains world access and draft controls at enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('http://127.0.0.1:3102/?mode=home-handoff');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const field = page.getByRole('textbox', { name: 'What are we working on?' });
  await field.fill('Synthetic large text draft');
  await page.getByRole('button', { name: 'Continue in Talk' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(
    page
      .getByRole('navigation', { name: 'Your operating spaces' })
      .getByRole('link', { name: /Grooming/ }),
  ).toHaveAttribute('href', '/app/grooming');
});
