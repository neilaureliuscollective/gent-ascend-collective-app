import { expect, test } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
const folder = 'tests/fixtures/labels/';
for (const [name, width, height] of [
  ['desktop', 1440, 1000],
  ['fold', 344, 882],
] as const) {
  test(`complete synthetic label flow — ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const hold = async () => {
      if (process.env.STUDIO_LABEL_DEMO === '1') await page.waitForTimeout(2500);
    };
    await hold();
    await page.getByRole('button', { name: 'Create supplier label', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Create editable label', exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel('Supplier profile (.json)', { exact: true })
      .setInputFiles(folder + 'supplier-profile.json');
    await page
      .getByLabel('Original supplier template', { exact: true })
      .setInputFiles(folder + 'template-source.txt');
    await page
      .getByLabel('Original product facts', { exact: true })
      .setInputFiles(folder + 'facts-source.txt');
    await page
      .getByLabel('Approved logo (.svg)', { exact: true })
      .setInputFiles(folder + 'approved-fixture-logo.svg');
    await page
      .getByLabel('Talk brief (.json)', { exact: true })
      .setInputFiles(folder + 'talk-brief.json');
    await expect(
      page.getByText('Source files match the imported profile.', { exact: false }),
    ).toBeVisible();
    await hold();
    await mkdir('docs/evidence/studio-labels', { recursive: true });
    await page.screenshot({
      path: `docs/evidence/studio-labels/${name}-setup.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Create editable label', exact: true }).click();
    await expect(
      page.getByText('Supliful SYNTHETIC-NOT-A-SKU', { exact: false }).first(),
    ).toBeVisible();
    if (width < 700) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await hold();
    await page.getByRole('button', { name: /^Product name/ }).click();
    await page.getByRole('textbox', { name: 'Copy', exact: true }).fill('Aethelios Edition');
    await page.getByLabel('Font size (pt)', { exact: true }).fill('14');
    await page.getByLabel('Layer color', { exact: true }).fill('#E8C980');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByLabel('Layer color', { exact: true })).toHaveValue('#ffffff');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByLabel('Layer color', { exact: true })).toHaveValue('#e8c980');
    await hold();
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible();
    await hold();
    await page.reload();
    if (width < 700) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await hold();
    await page.getByRole('button', { name: /^Product name/ }).click();
    await expect(page.getByRole('textbox', { name: 'Copy', exact: true })).toHaveValue(
      'Aethelios Edition',
    );
    await page.getByRole('button', { name: 'Check label preflight', exact: true }).click();
    await expect(page.getByText('Preflight checked this draft.', { exact: false })).toBeVisible();
    await expect(page.getByText('BLOCKING:', { exact: false })).toHaveCount(0);
    await page.screenshot({
      path: `docs/evidence/studio-labels/${name}-editor.png`,
      fullPage: true,
    });
    await hold();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(`docs/evidence/studio-labels/${name}-download.pdf`);
    await page.getByRole('button', { name: /^Supplier specimen copy/ }).click();
    await expect(page.getByRole('textbox', { name: 'Copy', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `docs/evidence/studio-labels/${name}-protected.png`,
      fullPage: true,
    });
    await hold();
    const video = page.video();
    await page.close();
    if (video)
      await copyFile(await video.path(), `docs/evidence/studio-labels/${name}-full-flow.webm`);
  });
}
