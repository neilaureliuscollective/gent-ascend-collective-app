import { test, expect, type Page } from './fixtures';
import { readFile } from 'node:fs/promises';
const project = '10000000-0000-4000-8000-000000000001';
const reference = '10000000-0000-4000-8000-000000000002';
const owner = '60000000-0000-4000-8000-000000000001';
const brief = {
  purpose: '',
  audience: '',
  direction: '',
  palette: '',
  avoid: '',
  referenceId: null as string | null,
  brand: {
    name: 'Fixture brand',
    voice: '',
    typography: 'editorial',
    background: '#080A0B',
    foreground: '#E6E7E2',
    accent: '#C4912F',
    logoReferenceId: null as string | null,
  },
};
async function setup(page: Page, options: { uncertain?: boolean; holdPrepare?: boolean } = {}) {
  const original = await readFile('public/brand/gent-ascend-master.png');
  const state = {
    prepare: 0,
    complete: 0,
    uploads: 0,
    handoffs: 0,
    generations: 0,
    uploaded: null as Buffer | null,
    brief: structuredClone(brief),
    chats: [] as Record<string, unknown>[],
    turns: [] as Record<string, unknown>[],
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/aurelius**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/aurelius/attachments') {
      const body = route.request().postDataJSON();
      if (body.action === 'prepare') {
        state.prepare++;
        if (options.holdPrepare) await gate;
        return route.fulfill({
          json: {
            id: reference,
            projectId: project,
            path: `synthetic/${project}/${reference}.png`,
            token: 'synthetic-only',
            url: 'https://storage-fixture.test',
            publishableKey: 'synthetic-public-only',
          },
        });
      }
      if (body.action === 'complete') {
        state.complete++;
        if (options.uncertain && state.complete === 1)
          return route.fulfill({
            status: 503,
            json: { error: 'Synthetic completion response lost. Retry verification.' },
          });
        return route.fulfill({ json: { id: reference, projectId: project } });
      }
      if (body.action === 'studio') {
        state.handoffs++;
        expect(body).toMatchObject({ projectId: project, id: reference });
        state.brief.referenceId = reference;
        return route.fulfill({
          json: {
            projectId: project,
            referenceId: reference,
            href: `/app/studio?project=${project}&reference=${reference}`,
          },
        });
      }
    }
    if (url.pathname.endsWith('/chat')) {
      const body = route.request().postDataJSON();
      state.chats.push(body);
      const turn = {
        id: body.requestId,
        person_id: owner,
        conversation_id: body.conversationId,
        user_text: body.text,
        assistant_text: 'Synthetic image analysis receipt',
        status: 'complete',
        model: 'synthetic-model',
        context_included: false,
        prompt_version: 'fixture',
        feedback: null,
        created_at: '2026-10-15T12:00:00Z',
        finished_at: '2026-10-15T12:00:01Z',
      };
      state.turns.push(turn);
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: JSON.stringify({ type: 'saved', turn }) + '\n',
      });
    }
    const id = url.searchParams.get('conversationId');
    return route.fulfill({
      json: {
        ownerId: owner,
        conversations: [],
        turns: state.turns,
        memories: [],
        actionProposals: [],
        context: { profile: null, goal: null, memories: [] },
        canChat: true,
        configured: true,
        model: 'synthetic-model',
        currentConversation: id
          ? {
              id,
              person_id: owner,
              title: 'Synthetic images',
              created_at: '2026-10-15T12:00:00Z',
              updated_at: '2026-10-15T12:00:00Z',
            }
          : null,
      },
    });
  });
  await page.route('https://storage-fixture.test/**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'PUT, OPTIONS',
        },
      });
    state.uploads++;
    const request = new Request(route.request().url(), {
      method: 'POST',
      headers: { 'Content-Type': route.request().headers()['content-type']! },
      body: new Blob([new Uint8Array(route.request().postDataBuffer()!)]),
    });
    const multipart = await request.formData();
    const file = multipart.get('') as File;
    state.uploaded = Buffer.from(await file.arrayBuffer());
    expect(state.uploaded).toEqual(original);
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: { Key: `aethelios-studio/synthetic/${project}/${reference}.png` },
    });
  });
  await page.route('**/api/studio**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/studio/image') {
      expect(url.searchParams.get('id')).toBe(reference);
      return route.fulfill({ contentType: 'image/png', body: original });
    }
    if (route.request().method() === 'PATCH') {
      state.brief = route.request().postDataJSON().brief;
      return route.fulfill({ json: { id: project } });
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body.action === 'select') {
        state.brief.referenceId = body.id;
        return route.fulfill({ json: { projectId: project, referenceId: body.id } });
      }
      state.generations++;
      return route.fulfill({ status: 400, json: { error: 'No automatic generation allowed' } });
    }
    return route.fulfill({
      json: {
        owner,
        projects: [
          {
            id: project,
            title: 'Talk attachments',
            creative_type: 'personal',
            brief: state.brief,
            updated_at: '2026-10-15T12:00:00Z',
          },
        ],
        projectId: project,
        references: [
          {
            id: reference,
            created_at: '2026-10-15T12:00:00Z',
            storage_key: `synthetic/${project}/${reference}.png`,
          },
        ],
        versions: [],
        scenes: [],
        finishes: [],
        designs: [],
        compositions: [],
        renders: [],
        designExports: [],
        narrations: [],
        footage: [],
        configured: false,
        canCreate: false,
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/app/aethelios?mode=talk-live');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeEnabled();
  return { state, original, release };
}
for (const width of [390, 768])
  test(`Talk image analysis and durable Studio reference preserve original at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 712 });
    const { state, original } = await setup(page);
    await expect(page.getByRole('button', { name: 'Add image', exact: true })).toBeVisible();
    await page
      .getByLabel('Choose image for Talk')
      .setInputFiles({ name: 'original-logo.png', mimeType: 'image/png', buffer: original });
    await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
    await expect(page.getByAltText('Image attachment: original-logo.png')).toBeVisible();
    await page
      .getByLabel('Message Aethelios', { exact: true })
      .fill('Analyze this image; do not generate anything');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Analyze with next message', exact: true }),
    ).toBeVisible();
    expect(state.chats[0]).toMatchObject({ attachmentId: reference });
    await page
      .getByLabel('Message Aethelios', { exact: true })
      .fill('A follow-up without resending the image');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => state.chats.length).toBe(2);
    expect(state.chats[1]?.attachmentId).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Use in Studio', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Open selected Studio reference' }),
    ).toHaveAttribute('href', `/app/studio?project=${project}&reference=${reference}`);
    expect(state.brief.referenceId).toBe(reference);
    expect(state.brief.brand.logoReferenceId).toBeNull();
    expect(state.uploaded).toEqual(original);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/talk-image-${width}.png`, fullPage: true });
    await page.goto(
      `http://127.0.0.1:3102/app/studio?mode=studio-reference&project=${project}&reference=${reference}`,
    );
    await expect(page.getByText('Using this reference', { exact: true })).toBeVisible();
    await expect(page.getByAltText('Selected source')).toHaveAttribute(
      'src',
      `/api/studio/image?id=${reference}&kind=reference`,
    );
    await page.reload();
    await expect(page.getByText('Using this reference', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Direction', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Original logo', exact: true })
      .selectOption(reference);
    await page.getByRole('button', { name: 'Save direction', exact: true }).click();
    await expect.poll(() => state.brief.brand.logoReferenceId).toBe(reference);
    expect(state.generations).toBe(0);
    expect(state.uploads).toBe(1);
    expect(state.prepare).toBe(1);
    await page.screenshot({ path: `test-results/studio-reference-${width}.png`, fullPage: true });
  });
test('uncertain upload completion retries the original reference without another transfer', async ({
  page,
}) => {
  const { state, original } = await setup(page, { uncertain: true });
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByRole('button', { name: 'Retry image upload' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry image upload' }).click();
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
  expect(state.uploads).toBe(1);
  expect(state.prepare).toBe(1);
  expect(state.complete).toBe(2);
});
test('Remove fences a late preparation; unsupported files never upload', async ({ page }) => {
  const { state, original, release } = await setup(page, { holdPrepare: true });
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(200) });
  await expect(page.getByRole('alert')).toContainText('unsupported');
  expect(state.prepare).toBe(0);
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByLabel('Image upload and verification')).toBeVisible();
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  release();
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Image upload and verification')).toHaveCount(0);
  expect(state.uploads).toBe(0);
  expect(state.complete).toBe(0);
});

test('starting a new conversation fences the previous pending image upload', async ({ page }) => {
  const { state, original, release } = await setup(page, { holdPrepare: true });
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'old-context.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByLabel('Image upload and verification')).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  release();
  await expect(page.getByLabel('Image upload and verification')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toHaveCount(0);
  expect(state.uploads).toBe(0);
  expect(state.complete).toBe(0);
});
test('a stale Studio handoff never silently selects another reference or starts generation', async ({
  page,
}) => {
  const { state } = await setup(page);
  state.brief.referenceId = null;
  await page.goto(
    `http://127.0.0.1:3102/app/studio?mode=studio-reference&project=${project}&reference=${reference}`,
  );
  await expect(
    page.getByText(
      'This reference handoff is stale or unavailable. Choose a project reference again.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Using this reference', { exact: true })).toHaveCount(0);
  expect(state.generations).toBe(0);
});
