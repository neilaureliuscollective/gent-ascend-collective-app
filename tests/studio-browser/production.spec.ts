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
  await page.getByLabel('Import layout recipe', { exact: true }).setInputFiles({
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
  await expect(
    page.getByRole('button', { name: 'Export campaign pack', exact: false }),
  ).toBeEnabled();

  await tabs.getByRole('button', { name: 'Campaign', exact: true }).click();
  await page.getByLabel('Seconds per scene').selectOption('2');
  // Real short WAV soundtrack exercises AudioContext and the recorded audio track.
  const samples = 16000,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 220) / 8000) * 1000), 44 + i * 2);
  await page
    .getByLabel('Optional soundtrack', { exact: false })
    .setInputFiles({ name: 'fixture-tone.wav', mimeType: 'audio/wav', buffer: wav });

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
  expect(
    await page.evaluate(() =>
      (window as unknown as { studioTracks: MediaStreamTrack[] }).studioTracks
        .map((t) => t.kind)
        .sort(),
    ),
  ).toEqual(['audio', 'video']);
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
  await expect(
    page.getByRole('region', { name: 'Campaign production', exact: true }).getByRole('alert'),
  ).toContainText('cancelled');
  await expect(page.getByRole('button', { name: 'Download film', exact: false })).toHaveCount(0);
});

test('narration requires fresh approval, saves a clip, plays real WAV audio, and produces a narrated campaign with scene subtitles', async ({
  page,
}) => {
  await setup(page);
  const wav = Buffer.alloc(44 + 32000);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(32000, 40);
  for (let i = 0; i < 16000; i++)
    wav.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 220) / 8000) * 1000), 44 + i * 2);
  const workspace = {
    available: true,
    enabled: true,
    canCreate: true,
    items: [] as Record<string, unknown>[],
  };
  let generations = 0;
  await page.route('**/api/studio/narration**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/audio'))
      return route.fulfill({ contentType: 'audio/wav', body: wav });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.approved).toBe(true);
      generations++;
      workspace.items = [
        {
          ...body,
          model: 'gpt-audio-1.5',
          status: 'complete',
          duration: 2,
          created_at: '2026-10-12T00:00:00Z',
        },
      ];
      return route.fulfill({ status: 201, json: { id: body.id } });
    }
    return route.fulfill({ json: workspace });
  });
  const tabs = page.getByRole('group', { name: 'Studio workspace views' });
  await tabs.getByRole('button', { name: 'Narration', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare from campaign copy', exact: true }).click();
  await expect(page.getByLabel('Narration script', { exact: true })).toHaveValue(
    'Made with intention.',
  );
  const generate = page.getByRole('button', { name: 'Generate approved narration', exact: true });
  await expect(generate).toBeDisabled();
  const approval = page.getByRole('checkbox', {
    name: 'I approve this script and authorize one AI narration request.',
  });
  await approval.check();
  await page.getByLabel('Narration voice', { exact: true }).selectOption('ash');
  await expect(approval).not.toBeChecked();
  await expect(generate).toBeDisabled();
  await approval.check();
  await generate.click();
  const audio = page.getByLabel('AI narration: Campaign narration');
  await expect(audio).toBeVisible();
  await audio.evaluate(async (node) => {
    await (node as HTMLAudioElement).play();
  });
  await expect
    .poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.2);
  expect(generations).toBe(1);
  const audioDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download WAV', exact: false }).click();
  await (await audioDownload).saveAs('test-results/studio-narration.wav');
  await page.getByRole('button', { name: 'Use in campaign film', exact: true }).click();
  await page.getByLabel('Seconds per scene').selectOption('2');
  await page.getByRole('button', { name: 'Render motion film', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download film', exact: false })).toBeVisible({
    timeout: 20000,
  });
  const subtitleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export VTT captions', exact: false }).click();
  await (await subtitleDownload).saveAs('test-results/studio-campaign-captions.vtt');
});
test('narration remains honest and script exportable before backend activation', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/studio/narration**', (route) =>
    route.fulfill({ json: { available: false, enabled: false, canCreate: false, items: [] } }),
  );
  await page
    .getByRole('group', { name: 'Studio workspace views' })
    .getByRole('button', { name: 'Narration', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Narration production' })).toContainText(
    'awaiting activation',
  );
  await page.getByLabel('Narration script', { exact: true }).fill('A reviewed script.');
  await page
    .getByRole('checkbox', {
      name: 'I approve this script and authorize one AI narration request.',
    })
    .check();
  await expect(
    page.getByRole('button', { name: 'Generate approved narration', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export script', exact: false })).toBeEnabled();
});
