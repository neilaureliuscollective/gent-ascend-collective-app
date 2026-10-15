import { test, expect } from './fixtures';
import { installMaterialFixture } from '../fixtures/creation-materials';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 390, height: 420 },
  { width: 720, height: 540 },
  { width: 884, height: 690 },
]) {
  test(`Talk consent remains pointer accessible at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installMaterialFixture(page);
    let admissions = 0;
    await page.route('**/api/aethelios/live', async (route) => {
      if (route.request().method() !== 'GET') admissions++;
      await route.fulfill({ json: { jobs: [] } });
    });
    await page.goto('http://127.0.0.1:3102/app/aethelios?mode=talk-live');
    await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
    const consent = page.getByRole('group', { name: 'Voice pilot consent' });
    const start = consent.getByRole('button', { name: 'Start voice', exact: true });
    await expect(start).toBeDisabled();
    await consent.getByRole('checkbox', { name: /I consent/ }).check();
    await expect(start).toBeEnabled();
    await start.click({ trial: true });
    await page.screenshot({
      path: `test-results/charcoal-consent-${viewport.width}-${viewport.height}.png`,
    });
    expect(admissions).toBe(0);
    await consent.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(consent).toHaveCount(0);
  });
}
