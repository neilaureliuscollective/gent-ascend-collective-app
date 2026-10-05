import { test, expect } from './fixtures';

test('living connections stay attached through Fold resize and source inspection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  for (const [width, height] of [
    [390, 844],
    [768, 900],
    [900, 700],
    [1440, 900],
    [360, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const field = document.querySelector('.field-space')!;
          const box = field.getBoundingClientRect();
          const groups = [
            ...field.querySelectorAll<SVGGElement>('.field-connections g[data-signal]'),
          ];
          const buttons = [...field.querySelectorAll<HTMLButtonElement>('.field-signal')];
          if (groups.length !== buttons.length) return 999;
          return Math.max(
            0,
            ...groups.map((group) => {
              const button = buttons.find(
                (button) => button.dataset.signalId === group.dataset.signal,
              )!;
              const target = button.getBoundingClientRect();
              const core = field.querySelector('.command-presence')!.getBoundingClientRect();
              const x =
                (target.left + target.width / 2 < core.left + core.width / 2
                  ? target.right
                  : target.left) - box.left;
              const y = target.top + target.height / 2 - box.top;
              const path = group.querySelector<SVGPathElement>('.connection-filament')!;
              const end = path.getPointAtLength(path.getTotalLength());
              return Math.hypot(end.x - x, end.y - y);
            }),
          );
        }),
      )
      .toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: /Energy/ }).click();
  await expect(page.locator('.signal-detail')).toContainText('not a readiness score');
  await expect(page.locator('.field-connections g[data-selected="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close detail' }).click();
  await expect(page.getByRole('button', { name: /Energy/ })).toBeFocused();
});

test('saved completion produces one finite return trace; refresh failure produces none', async ({
  page,
}) => {
  const { sampleData } = await import('../../src/domains/daily/model');
  const data = {
    ...sampleData('2026-09-21'),
    mode: 'personal',
    ownerId: '60000000-0000-4000-8000-000000000001',
  };
  await page.route('**/api/daily/complete', async (route) => {
    data.entries.find((e) => e.day === data.today)!.actions[1]!.done = true;
    await route.fulfill({ json: { done: true, version: 2 } });
  });
  await page.route('**/api/command', (route) =>
    route.fulfill({ json: { data, asOf: '2026-09-21T14:00:00Z' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await expect(page.locator('.connection-trace')).toHaveCount(3);
  await expect(page.locator('.connection-trace[data-flow]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.locator('.connection-trace[data-signal="actions"]')).toHaveAttribute(
    'data-flow',
    'confirmed',
  );
  await expect
    .poll(() =>
      page
        .locator('.connection-trace')
        .evaluateAll(
          (paths) =>
            paths.flatMap((p) => p.getAnimations()).filter((a) => a.playState === 'running').length,
        ),
    )
    .toBe(0);
  await page.route('**/api/command', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.locator('.home-records > summary').click();
  await page.getByRole('button', { name: 'Refresh briefing' }).click();
  await expect(page.locator('.field-space')).toHaveAttribute('data-state', 'stale');
  expect(
    await page
      .locator('.connection-trace')
      .evaluateAll((paths) => paths.flatMap((p) => p.getAnimations()).length),
  ).toBe(0);
});

test('Still and unknown context retain usable controls without active traces', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=empty');
  await expect(page.locator('.field-signal')).toHaveCount(0);
  await expect(page.locator('.connection-filament')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open day workspace', exact: true })).toBeVisible();
  await page.goto('/app');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await expect(page.locator('.connection-filament')).toHaveCount(3);
  await expect(page.locator('.command-presence canvas')).toHaveCount(0);
  expect(
    await page
      .locator('.connection-trace')
      .evaluateAll((paths) => paths.flatMap((p) => p.getAnimations()).length),
  ).toBe(0);
});
