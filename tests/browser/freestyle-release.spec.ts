import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { performanceFixture } from '../component-fixture/performance';
for (const width of [360, 768]) {
  test(`freestyle workout starts from chosen movements at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    let latest: Record<string, unknown> | null = null;
    let version = 0;
    await page.route('**/api/performance', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: performanceFixture });
      const body = route.request().postDataJSON();
      latest = body.payload;
      return route.fulfill({ json: { version: ++version, owner: performanceFixture.owner } });
    });
    await page.goto(componentUrl('/?mode=performance'));
    await page.getByRole('button', { name: 'Enter training' }).click();
    await page.getByLabel('Movement', { exact: true }).fill('Incline plate-loaded press');
    await page.getByLabel('Sets', { exact: true }).fill('2');
    await page.getByLabel('Rep target', { exact: true }).fill('8');
    await page.getByRole('button', { name: 'Add movement', exact: true }).click();
    expect(latest).toBeNull();
    await page.getByRole('button', { name: 'Start this workout →', exact: true }).click();
    await expect(page.getByLabel('Set 1 reps')).toBeVisible();
    await expect
      .poll(() => latest)
      .toMatchObject({
        status: 'active',
        sets: [{ exercise: 'Incline plate-loaded press', targetReps: 8 }, { targetReps: 8 }],
      });
    await page.getByLabel('Set 1 reps').fill('7');
    await page.getByRole('button', { name: 'Record set 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo set 1', exact: true })).toBeVisible();
    await page.screenshot({
      path: info.outputPath('freestyle-live.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.reload();
    await page.getByRole('button', { name: 'Training', exact: true }).click();
    await expect(page.getByLabel('Set 1 reps')).toHaveValue('7');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
