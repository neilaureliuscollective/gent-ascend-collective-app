import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import {
  installMaterialFixture,
  openMaterialTalk,
  openMaterialArchitect,
  openMaterialDocument,
  openMaterialStudio,
} from '../fixtures/creation-materials';

const views = [
  ['phone', 390, 844],
  ['fold-narrow', 690, 884],
  ['fold-wide', 884, 690],
  ['desktop', 1440, 900],
  ['keyboard', 390, 520],
] as const;

for (const [label, width, height] of views) {
  test(`creation materials stay dimensional and readable at ${label}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await installMaterialFixture(page);
    await page.setViewportSize({ width, height });
    await openMaterialTalk(page);
    const composer = page.locator('.aurelius-composer');
    await expect(composer.locator('svg.bplus-optics')).toBeVisible();
    const geometry = await composer.locator('svg.bplus-optics').boundingBox();
    expect(geometry!.width).toBeGreaterThan(width < 700 ? width * 0.75 : 500);
    expect(geometry!.height).toBeGreaterThan(80);
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeFocused();
    await expect(composer).toHaveCSS('outline-style', 'solid');
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveCSS(
      'outline-style',
      'none',
    );
    await expect(page.locator('.talk-creation-card')).not.toHaveCSS('box-shadow', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    // Read actual rendered paint, not just a token declaration or DOM class.
    const card = page.locator('.talk-creation-card');
    const bitmap = PNG.sync.read(await card.screenshot({ animations: 'disabled' }));
    const pixel = (10 * bitmap.width + 10) * 4;
    expect(bitmap.data[pixel + 1]).toBeGreaterThan(bitmap.data[pixel]! + 3);
    expect(bitmap.data[pixel + 1]).toBeLessThan(110);
    const files: { path: string; bytes: number; sha256: string }[] = [];
    async function capture(name: string) {
      const path = `${name}-${label}.png`;
      const bytes = await page.screenshot({
        path: info.outputPath(path),
        animations: 'disabled',
        fullPage: name === 'studio',
      });
      files.push({
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      const baseline = `docs/evidence/creation-materials/before-${path}`;
      {
        const before = readFileSync(baseline);
        copyFileSync(baseline, info.outputPath(`before-${path}`));
        files.push({
          path: `before-${path}`,
          bytes: before.length,
          sha256: createHash('sha256').update(before).digest('hex'),
        });
      }
    }
    await capture('talk');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
      'Review the direction and preserve this unsent draft.',
    );
    await expect(page.getByRole('group', { name: 'Document view' })).toBeVisible();
    await capture('talk-document');

    await openMaterialArchitect(page);
    await capture('architect-blueprint');
    await openMaterialDocument(page);
    const canvas = await page.locator('.origin-plane').boundingBox();
    expect(canvas!.width).toBeGreaterThan(width * (width > 1100 ? 0.42 : width > 600 ? 0.5 : 0.82));
    await page
      .getByLabel('Editable Markdown')
      .fill('# Field notes studio\n\nKeep this visible draft through view changes.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Editable Markdown')).toHaveValue(/Keep this visible draft/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await capture('architect-document');
    await page
      .locator('.origin-plane')
      .getByRole('button', { name: 'Focus canvas', exact: true })
      .click();
    await expect(page.locator('.origin-refine')).toBeHidden();
    await expect(page.locator('.origin-rail')).toBeHidden();
    expect((await page.locator('.origin-plane').boundingBox())!.width).toBeGreaterThan(
      width * 0.82,
    );
    await page
      .locator('.origin-plane')
      .getByRole('button', { name: 'Show Aethelios tools', exact: true })
      .click();
    await expect(page.getByLabel('Editable Markdown')).toHaveValue(/Keep this visible draft/);

    await openMaterialStudio(page);
    const rooms = page.getByRole('group', { name: 'Studio workspace views' });
    await expect(rooms.getByRole('button')).toHaveCount(10);
    await expect(rooms.getByRole('button', { name: 'Design', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(rooms.getByRole('button', { name: 'Create', exact: true })).not.toHaveCSS(
      'box-shadow',
      'none',
    );
    await expect(
      page.getByRole('status').filter({ hasText: 'Design and Film need workspace setup' }),
    ).toBeVisible();
    await expect(page.getByText(/supabase\/migrations/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const tileBitmap = PNG.sync.read(
      await rooms
        .getByRole('button', { name: 'Create', exact: true })
        .screenshot({ animations: 'disabled' }),
    );
    const tilePixel = (10 * tileBitmap.width + 10) * 4;
    expect(tileBitmap.data[tilePixel + 1]).toBeGreaterThan(tileBitmap.data[tilePixel]! + 3);
    await rooms.getByRole('button', { name: 'Design', exact: true }).focus();
    await expect(rooms.getByRole('button', { name: 'Design', exact: true })).toHaveCSS(
      'outline-style',
      'solid',
    );
    await capture('studio');
    await rooms.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByLabel('Color direction').fill('Emerald glass, obsidian and restrained gold');
    await rooms.getByRole('button', { name: 'Library', exact: true }).click();
    await rooms.getByRole('button', { name: 'Direction', exact: true }).click();
    await expect(page.getByLabel('Color direction')).toHaveValue(
      'Emerald glass, obsidian and restrained gold',
    );
    await rooms.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      page.getByText(
        'Image generation is awaiting a server model connection. Projects and references remain available.',
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('manifest.json'),
      JSON.stringify(
        {
          commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          kind: 'production-build-with-labelled-API-fixture',
          workingTreeDirty: Boolean(
            execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
          ),
          productionBaseline: '58a59df9cb1d56694f13c71c8f36d85d7b321daf',
          viewport: { width, height },
          files,
        },
        null,
        2,
      ) + '\n',
    );
  });
}

test('material preferences and missing palette values preserve readable controls', async ({
  page,
}) => {
  await installMaterialFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMaterialTalk(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await page.locator('[data-bplus="talk"]').evaluate((element) => {
    const el = element as HTMLElement;
    for (const name of ['--aether-optical-substrate', '--aether-optical-shadow', '--io-text'])
      el.style.setProperty(name, 'initial');
  });
  await expect(page.locator('.aurelius-composer')).toHaveCSS('background-color', 'rgb(6, 22, 15)');
  await expect(page.locator('.aurelius-composer')).toHaveCSS('color', 'rgb(232, 233, 226)');
  await page.locator('[data-bplus="talk"]').evaluate((el) => el.removeAttribute('style'));
  await page.evaluate(() => {
    localStorage.setItem('aurelius-material', 'solid');
    window.dispatchEvent(new Event('storage'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  await expect(page.locator('.aurelius-composer > svg.bplus-optics')).toBeHidden();
  await openMaterialArchitect(page);
  await expect(page.getByLabel('Blueprint section')).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active' });
  const system = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'background:Canvas;color:CanvasText;position:fixed;opacity:0';
    document.body.appendChild(probe);
    const result = {
      background: getComputedStyle(probe).backgroundColor,
      color: getComputedStyle(probe).color,
    };
    probe.remove();
    return result;
  });
  await expect(page.locator('.origin-studio')).toHaveCSS('background-color', system.background);
  await expect(page.locator('.origin-studio')).toHaveCSS('color', system.color);
  await expect(page.getByRole('button', { name: 'Deliverables', exact: true })).toBeVisible();
  await openMaterialStudio(page);
  const studioDesign = page
    .getByRole('group', { name: 'Studio workspace views' })
    .getByRole('button', { name: 'Design', exact: true });
  await expect(studioDesign).toHaveCSS('background-color', system.background);
  await expect(studioDesign).toHaveCSS('color', system.color);
});
