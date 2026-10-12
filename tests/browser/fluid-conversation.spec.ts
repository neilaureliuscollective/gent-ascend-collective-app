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
test('desktop Shift+Enter stays multiline, and Ctrl+Enter submits', async ({ page }) => {
  await page.goto(fixture);
  await input(page).fill('Desktop first line');
  await input(page).press('Shift+Enter');
  await expect(input(page)).toHaveValue('Desktop first line\n');
  await input(page).press('Control+Enter');
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop reply' }).click();
});

test('records content-free acknowledgement and response DOM timings', async ({
  page,
}, testInfo) => {
  await page.goto(fixture);
  await page.evaluate(() => {
    localStorage.setItem('aethelios-timing', '1');
    const samples: unknown[] = [];
    (window as unknown as { fluidSamples: unknown[] }).fluidSamples = samples;
    window.addEventListener('aethelios:timing', (event) =>
      samples.push((event as CustomEvent).detail),
    );
  });
  await input(page).fill('PRIVATE SYNTHETIC PROMPT');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect(page.locator('.message-markdown')).toContainText('Synthetic response');
  const samples = await page.evaluate(
    () =>
      (window as unknown as { fluidSamples: { stage: string; elapsedMs: number }[] }).fluidSamples,
  );
  expect(samples.map((item) => item.stage)).toContain('acknowledgement-render');
  expect(samples.map((item) => item.stage)).toContain('first-render');
  expect(JSON.stringify(samples)).not.toMatch(/PRIVATE|PROMPT|response for motion/);
  for (const item of samples) expect(Object.keys(item).sort()).toEqual(['elapsedMs', 'stage']);
  console.log('FLUID_TIMING|' + JSON.stringify(samples));
  await testInfo.attach('synthetic-conversation-timing', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json',
  });
  await page.getByRole('button', { name: 'Stop reply' }).click();
});

test('streaming leaves readers in place until they choose the latest message', async ({ page }) => {
  await page.goto(`${fixture}?longReply=1&history=1`);
  await expect(page.locator('.conversation-turn')).toHaveCount(40);
  await input(page).fill('Long synthetic response');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit response text' }).click();
  const transcript = page.locator('.conversation-scroll');
  await expect
    .poll(() => transcript.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(500);
  await transcript.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('button', { name: 'Latest message' })).toBeVisible();
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect.poll(() => transcript.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'Latest message' }).click();
  await expect.poll(() => transcript.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Stop reply' }).click();
});
test('leaving Talk during streaming aborts the transport and does not paint late content', async ({
  page,
}) => {
  await page.goto(fixture);
  await page.evaluate(() => {
    (window as unknown as { streamAborts: number }).streamAborts = 0;
    window.addEventListener('fixture:stream-aborted', () => {
      (window as unknown as { streamAborts: number }).streamAborts++;
    });
  });
  await input(page).fill('Synthetic navigation interruption');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(input(page)).toHaveValue('');
  await page.getByLabel('Surface', { exact: true }).selectOption('studio');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { streamAborts: number }).streamAborts))
    .toBe(1);
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await page.getByLabel('Surface', { exact: true }).selectOption('talk');
  await expect(input(page)).toBeVisible();
  await expect(page.locator('.conversation-turn')).toHaveCount(0);
});

test('simulated VisualViewport transitions preserve focus and usable bounds, and ignore pinch zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 344, height: 844 });
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      width: 344,
      scale: 1,
      offsetTop: 0,
      offsetLeft: 0,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
  await page.route('**/api/aurelius**', (route) =>
    route.fulfill({
      json: {
        ownerId: 'synthetic-owner',
        conversations: [],
        turns: [],
        memories: [],
        actionProposals: [],
        context: {
          profile: {
            name: 'Synthetic',
            priority: '',
            timezone: 'UTC',
            units: 'metric',
            updatedAt: '2026-10-12',
          },
          goal: null,
          memories: [],
        },
        canChat: true,
        configured: true,
        model: 'synthetic-test-model',
      },
    }),
  );
  await page.goto('/app/aethelios');
  await input(page).fill('Keep this draft through simulated keyboard transitions');
  await input(page).focus();
  const viewport = page.locator('.aethelios-page');
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 420, offsetTop: 20 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
    window.visualViewport!.dispatchEvent(new Event('scroll'));
  });
  await expect(viewport).toHaveCSS('height', '420px');
  await expect(viewport).toHaveCSS('top', '20px');
  await expect(input(page)).toBeFocused();
  expect(
    (await page.locator('.aurelius-composer').boundingBox())!.y +
      (await page.locator('.aurelius-composer').boundingBox())!.height,
  ).toBeLessThanOrEqual(441);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 420, offsetTop: 20, scale: 2 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(viewport).toHaveCSS('height', '844px');
  await expect(viewport).toHaveCSS('top', '0px');
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 844, offsetTop: 0, scale: 1 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(input(page)).toHaveValue('Keep this draft through simulated keyboard transitions');
  await expect(input(page)).toBeFocused();
});

test('desktop Enter submits a single-line draft', async ({ page }) => {
  await page.goto(fixture);
  await input(page).fill('Desktop single-line thought');
  await input(page).press('Enter');
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('.user-message')).toContainText('Desktop single-line thought');
  await page.getByRole('button', { name: 'Stop reply' }).click();
});

test.describe('touch composer actions', () => {
  test.use({ hasTouch: true });
  test('Send and Stop retain editor focus without forced refocusing', async ({ page }) => {
    await page.goto(fixture);
    await input(page).fill('Touch-composed thought');
    await input(page).focus();
    await page.getByRole('button', { name: 'Send', exact: true }).tap();
    await expect(input(page)).toHaveValue('');
    await expect(input(page)).toBeFocused();
    await page.keyboard.insertText('Next thought');
    await page.getByRole('button', { name: 'Stop reply' }).tap();
    await expect(input(page)).toBeFocused();
    await expect(input(page)).toHaveValue('Next thought');
  });
});
