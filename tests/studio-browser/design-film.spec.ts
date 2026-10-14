import { expect, test, type Page } from '@playwright/test';

const project = '10000000-0000-4000-8000-000000000001';
const design = '10000000-0000-4000-8000-000000000010';
const composition = '10000000-0000-4000-8000-000000000011';
const version = '10000000-0000-4000-8000-000000000002';
const scene = '40000000-0000-4000-8000-000000000001';

async function studio(page: Page) {
  await page.route('**/api/studio**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/studio/image') {
      const bytes = await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#0B3B32';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#C4912F';
        ctx.fillRect(40, 70, 240, 12);
        return c.toDataURL('image/png').split(',')[1]!;
      });
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(bytes, 'base64') });
    }
    return route.fulfill({
      json: {
        owner: 'synthetic-owner',
        projects: [
          {
            id: project,
            title: 'Synthetic campaign',
            creative_type: 'campaign',
            brief: { purpose: 'A fixture launch', audience: 'Fixture customers', direction: 'Quiet', palette: 'Gold', avoid: 'False claims' },
            updated_at: '2026-10-12T00:00:00Z',
          },
        ],
        projectId: project,
        versions: [
          {
            id: version,
            parent_id: null,
            reference_id: null,
            prompt: 'Synthetic frame',
            model: 'gpt-image-2.5-flare',
            image_size: '1024x1024',
            status: 'complete',
            created_at: '2026-10-12T00:00:00Z',
          },
        ],
        references: [],
        scenes: [],
        finishes: [],
        designs: [
          {
            id: design,
            title: 'ISO ID-1 proof',
            revision: 1,
            updated_at: '2026-10-14T00:00:00Z',
            document: {
              schema: 'studio-design/v1',
              id: design,
              title: 'ISO ID-1 proof',
              page: {
                width: 85.6,
                height: 53.98,
                unit: 'mm',
                ppi: 300,
                bleed: { top: 2, right: 2, bottom: 2, left: 2 },
                safe: { top: 3, right: 3, bottom: 3, left: 3 },
                dimensionSource: 'verified',
                dimensionNote: 'ISO/IEC 7810 ID-1',
                background: '#080A0B',
              },
              layers: [
                {
                  id: '30000000-0000-4000-8000-000000000001',
                  type: 'rect',
                  name: 'Plate',
                  parentId: null,
                  visible: true,
                  locked: false,
                  opacity: 1,
                  x: 4,
                  y: 4,
                  width: 77,
                  height: 45,
                  rotation: 0,
                  fill: '#0B3B32',
                  stroke: '#C4912F',
                  strokeWidth: 0.6,
                  cornerRadius: 2,
                },
                {
                  id: '20000000-0000-4000-8000-000000000001',
                  type: 'text',
                  name: 'Headline',
                  parentId: null,
                  visible: true,
                  locked: false,
                  opacity: 1,
                  x: 8,
                  y: 16,
                  width: 70,
                  height: 18,
                  rotation: 0,
                  content: 'Aethelios Studio',
                  fontId: 'inter',
                  fontSize: 18,
                  fontWeight: 600,
                  align: 'left',
                  letterSpacing: 0,
                  lineHeight: 1.2,
                  fill: '#C4912F',
                },
              ],
              guides: { trim: true, bleed: true, safe: true },
            },
          },
        ],
        compositions: [
          {
            id: composition,
            title: 'Studio film',
            revision: 1,
            updated_at: '2026-10-14T00:00:00Z',
            document: {
              schema: 'studio-composition/v1',
              id: composition,
              title: 'Studio film',
              aspect: 'landscape',
              fps: 24,
              scenes: [
                {
                  id: scene,
                  kind: 'image',
                  assetId: version,
                  assetKind: 'version',
                  name: 'Opening',
                  inMs: 0,
                  outMs: 3000,
                  durationMs: 3000,
                  crop: { x: 0, y: 0, width: 1, height: 1 },
                  placement: { x: 0, y: 0, width: 1, height: 1 },
                  transition: 'cut',
                  stillMotion: 'none',
                },
              ],
              titles: [],
              captions: [{ id: '40000000-0000-4000-8000-000000000006', startMs: 400, endMs: 2400, text: 'Aethelios Studio' }],
              narration: null,
              music: null,
            },
          },
        ],
        renders: [],
        narrations: [],
        footage: [],
        render: { hosted: 'unavailable', generation: 'disabled', narration: 'disabled', footage: 'disabled' },
        configured: true,
        canCreate: true,
      },
    });
  });
  await page.goto('/app/studio');
  await expect(page.getByRole('heading', { name: 'Synthetic campaign', exact: true })).toBeVisible();
}

const viewports = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'fold', width: 717, height: 512 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`Design and Film workspaces at simulated ${viewport.name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await studio(page);
    const tabs = page.getByRole('group', { name: 'Studio workspace views' });
    await tabs.getByRole('button', { name: 'Design', exact: true }).click();
    if (viewport.width <= 980) await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByRole('button', { name: 'Export PNG' })).toBeVisible({ timeout: 20000 });
    await page.screenshot({
      path: `test-results/studio-design-${viewport.name}.png`,
      fullPage: true,
    });
    await tabs.getByRole('button', { name: 'Film', exact: true }).click();
    if (viewport.width <= 980) await page.getByRole('button', { name: 'Inspector' }).click();
    await expect(page.getByRole('button', { name: 'Render film' })).toBeVisible();
    await page.screenshot({
      path: `test-results/studio-film-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
