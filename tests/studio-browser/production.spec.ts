import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const project = '10000000-0000-4000-8000-000000000001',
  version = '10000000-0000-4000-8000-000000000002',
  scene = '10000000-0000-4000-8000-000000000003';
async function setup(page: Page) {
  const data = {
    owner: 'synthetic-owner',
    projects: [
      {
        id: project,
        title: 'Synthetic campaign',
        creative_type: 'campaign',
        brief: {
          purpose: 'A fixture launch',
          audience: 'Fixture customers',
          direction: 'Quiet',
          palette: 'Gold',
          avoid: 'False claims',
          brand: {
            name: 'Fixture Brand',
            voice: 'Clear',
            background: '#080A0B',
            foreground: '#E6E7E2',
            accent: '#C4912F',
            typography: 'editorial',
            logoReferenceId: null,
          },
        },
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
    scenes: [
      {
        id: scene,
        position: 0,
        title: 'A considered beginning',
        message: 'Made with intention.',
        visual_direction: 'Warm light',
        motion_note: 'Hold',
        channel: 'social',
        asset_version_id: version,
        updated_at: '2026-10-12T00:00:00Z',
      },
    ],
    finishes: [],
    configured: true,
    canCreate: true,
  };
  await page.route('**/api/studio**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/studio/image') {
      // A genuine decoded PNG rendered locally, not an image-provider acceptance test.
      const bytes = await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 640;
        const ctx = c.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 640, 640);
        gradient.addColorStop(0, '#36896c');
        gradient.addColorStop(1, '#080a0b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 640, 640);
        ctx.fillStyle = '#c4912f';
        ctx.fillRect(220, 140, 200, 360);
        return c.toDataURL('image/png').split(',')[1]!;
      });
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(bytes, 'base64') });
    }
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      data.projects[0]!.brief = body.brief;
      return route.fulfill({ json: { id: project } });
    }
    return route.fulfill({ json: data });
  });
  await page.goto('/app/studio');
  await expect(
    page.getByRole('heading', { name: 'Synthetic campaign', exact: true }),
  ).toBeVisible();
}
for (const width of [344, 720, 1440])
  test(`brand kit, saved direction and campaign room at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    const tabs = page.getByRole('group', { name: 'Studio workspace views' });
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByLabel('Brand name', { exact: true }).fill('My saved brand');
    await page.getByLabel('Brand voice', { exact: true }).fill('Precise and warm');
    await page.getByRole('button', { name: 'Save direction', exact: true }).click();
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await expect(page.getByLabel('Brand name', { exact: true })).toHaveValue('My saved brand');
    await tabs.getByRole('button', { name: 'Campaign', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Render motion film', exact: true }),
    ).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/studio-production-${width}.png`, fullPage: true });
  });
test('exports a real multi-format ZIP and a playable captured video, then releases its media tracks', async ({
  page,
}) => {
  await setup(page);
  const tabs = page.getByRole('group', { name: 'Studio workspace views' });
  await tabs.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByLabel('Headline', { exact: true }).fill('A new standard');
  await page.getByRole('button', { name: 'Apply brand name', exact: true }).click();
  const packEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export campaign pack', exact: false }).click();
  const pack = await packEvent;
  expect(pack.suggestedFilename()).toMatch(/campaign\.zip$/);
  await pack.saveAs('test-results/studio-campaign-pack.zip');
  await page
    .getByLabel('Import layout recipe', { exact: true })
    .setInputFiles({
      name: 'layout.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          sourceVersionId: version,
          brand: {
            name: 'Fixture Brand',
            voice: 'Clear',
            background: '#080A0B',
            foreground: '#E6E7E2',
            accent: '#C4912F',
            typography: 'editorial',
            logoReferenceId: null,
          },
          layout: {
            format: 'square',
            treatment: 'editorial',
            brand: 'Imported copy',
            headline: 'An editable return',
            supporting: '',
            footer: '',
            focal_x: 50,
            focal_y: 50,
          },
        }),
      ),
    });
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('An editable return');

  await tabs.getByRole('button', { name: 'Campaign', exact: true }).click();
  await page.getByLabel('Seconds per scene').selectOption('2');
  await page.evaluate(() => {
    const Original = window.MediaRecorder;
    class ObservedRecorder extends Original {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        (window as unknown as { studioTracks: MediaStreamTrack[] }).studioTracks =
          stream.getTracks();
      }
    }
    window.MediaRecorder = ObservedRecorder;
  });
  await page.getByRole('button', { name: 'Render motion film', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download film', exact: false })).toBeVisible({
    timeout: 20000,
  });
  const video = page.getByLabel('Completed campaign motion film');
  await expect(video).toBeVisible();
  await video.evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    await media.play();
  });
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.2);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download film', exact: false }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.(webm|mp4)$/);
  await download.saveAs('test-results/studio-motion-film.webm');
  expect(
    await page.evaluate(() =>
      (window as unknown as { studioTracks: MediaStreamTrack[] }).studioTracks.every(
        (t) => t.readyState === 'ended',
      ),
    ),
  ).toBe(true);
});
test('cancelled rendering never presents a finished film', async ({ page }) => {
  await setup(page);
  await page
    .getByRole('group', { name: 'Studio workspace views' })
    .getByRole('button', { name: 'Campaign', exact: true })
    .click();
  await page.getByRole('button', { name: 'Render motion film', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel rendering', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('cancelled');
  await expect(page.getByRole('button', { name: 'Download film', exact: false })).toHaveCount(0);
});
