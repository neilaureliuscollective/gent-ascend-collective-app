import { test, expect } from './fixtures';

const fixture = `http://127.0.0.1:${process.env.PLAYWRIGHT_FIXTURE_PORT || '3102'}/?mode=command-home`;

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [720, 820],
  [1440, 900],
] as const) {
  test(`Command home composition at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(fixture);
    await expect(page.getByRole('heading', { name: 'Command', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chamber brief' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'What are we working on?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Needs you' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/command-home-${width}.png`, fullPage: true });
  });
}

test('select owned project, inspect excerpt, resume, and keep draft through Talk', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(fixture);
  await page.getByRole('button', { name: /Second labelled site/ }).click();
  await expect(page.getByRole('heading', { name: 'Second labelled site' })).toBeVisible();
  await expect(page.getByText('Another synthetic Architect project.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue / Review' })).toHaveAttribute(
    'href',
    '/app/architect?project=61000000-0000-4000-8000-000000000002',
  );
  await page.getByRole('button', { name: /Labelled Atlas chamber/ }).click();
  await expect(page.getByText('The chamber keeps the saved work in view')).toBeVisible();
  await page.getByRole('textbox', { name: 'What are we working on?' }).fill('Keep this labelled draft with the chamber.');
  await page.setViewportSize({ width: 720, height: 820 });
  await expect(page.getByRole('textbox', { name: 'What are we working on?' })).toHaveValue(
    'Keep this labelled draft with the chamber.',
  );
  await page.getByRole('button', { name: 'Continue in Talk' }).click();
  await expect(page.getByRole('textbox', { name: 'Message Aethelios', exact: true })).toHaveValue(
    'Keep this labelled draft with the chamber.',
  );
  await expect(page.getByText('Continuing from Command', { exact: false })).toBeVisible();
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
        String(value).includes('labelled draft'),
      ),
    ),
  ).toBe(false);
});

test('empty Command stays quiet and signed-out Command asks for sign-in', async ({ page }) => {
  await page.goto(`${fixture}&empty=1`);
  await expect(page.getByText('Nothing saved yet', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs you' })).toHaveCount(0);
  await expect(page.getByText('revenue')).toHaveCount(0);
  await page.goto('http://127.0.0.1:3100/app');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Command', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to talk' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Founder Office' })).toHaveCount(0);
});

test('founder Command keeps Office separate from ordinary work', async ({ page }) => {
  await page.goto(`${fixture}&founder=1`);
  await expect(page.getByRole('heading', { name: 'Command', exact: true })).toBeVisible();
  await expect(page.getByLabel('Founder operations')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Founder Office' }).first()).toHaveAttribute(
    'href',
    '/app/founder',
  );
  await expect(page.getByRole('link', { name: 'Connections' })).toHaveAttribute(
    'href',
    '/app/founder/connections',
  );
});

test('rapid project changes keep the later selection and ignore stale responses', async ({
  page,
}) => {
  await page.goto(fixture);
  await page.route('**/api/command-home**', async (route) => {
    const url = route.request().url();
    if (url.includes('61000000-0000-4000-8000-000000000002')) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });
  await page.getByRole('button', { name: /Second labelled site/ }).click();
  await page.getByRole('button', { name: /Client review draft/ }).click();
  await expect(page.getByRole('heading', { name: 'Opening' })).toBeVisible();
  await expect(page.getByText('Unreviewed company work', { exact: false })).toBeVisible();
});

test('keyboard-constrained phone keeps the composer reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  const field = page.getByRole('textbox', { name: 'What are we working on?' });
  await field.fill('Keyboard-safe labelled thought');
  await field.focus();
  await page.setViewportSize({ width: 390, height: 440 });
  const action = page.getByRole('button', { name: 'Continue in Talk' });
  await expect
    .poll(async () => {
      const box = await action.boundingBox();
      const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
      return box && nav ? box.y + box.height - nav.y : 99;
    })
    .toBeLessThanOrEqual(8);
});
