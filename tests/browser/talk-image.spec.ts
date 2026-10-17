import { test, expect, type Page } from './fixtures';
import { readFile } from 'node:fs/promises';
const project = '10000000-0000-4000-8000-000000000001';
const reference = '10000000-0000-4000-8000-000000000002';
const version = '10000000-0000-4000-8000-000000000003';
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
async function setup(
  page: Page,
  options: {
    uncertain?: boolean;
    holdPrepare?: boolean;
    generation?: boolean;
    history?: boolean;
  } = {},
) {
  const original = await readFile('public/brand/gent-ascend-master.png');
  const state = {
    prepare: 0,
    complete: 0,
    uploads: 0,
    handoffs: 0,
    generations: 0,
    generationRequests: [] as Record<string, unknown>[],
    uploaded: null as Buffer | null,
    brief: structuredClone(brief),
    chats: [] as Record<string, unknown>[],
    turns: [] as Record<string, unknown>[],
  };
  if (options.history) {
    for (let index = 0; index < 8; index++)
      state.turns.push({
        id: `synthetic-turn-${index}`,
        person_id: owner,
        conversation_id: project,
        user_text: `Review image direction ${index + 1}`,
        assistant_text: `Saved conversation response ${index + 1}: keep the original logo and review the direction.`,
        status: 'complete',
        model: 'synthetic-model',
        context_included: false,
        prompt_version: 'fixture',
        feedback: null,
        created_at: '2026-10-15T12:00:00Z',
        finished_at: '2026-10-15T12:00:01Z',
      });
  }
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
      expect([reference, version]).toContain(url.searchParams.get('id'));
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
      state.generationRequests.push(body);
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
        versions: options.generation
          ? [
              {
                id: version,
                parent_id: null,
                reference_id: null,
                prompt: 'Synthetic saved version B',
                status: 'complete',
                model: 'synthetic-model',
                image_size: '1024x1024',
                created_at: '2026-10-15T12:00:00Z',
              },
            ]
          : [],
        scenes: [],
        finishes: [],
        designs: [],
        compositions: [],
        renders: [],
        designExports: [],
        narrations: [],
        footage: [],
        configured: Boolean(options.generation),
        canCreate: Boolean(options.generation),
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
    await expect(page.getByLabel('Image saved · details', { exact: true })).toBeVisible();
    expect(state.chats[0]).toMatchObject({ attachmentId: reference });
    await page
      .getByLabel('Message Aethelios', { exact: true })
      .fill('A follow-up without resending the image');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => state.chats.length).toBe(2);
    expect(state.chats[1]?.attachmentId).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Use in Studio', exact: true }).click();
    await page.getByLabel('Image saved · details', { exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Open selected Studio reference' }),
    ).toHaveAttribute('href', `/app/studio?project=${project}&reference=${reference}`);
    expect(state.brief.referenceId).toBe(reference);
    expect(state.brief.brand.logoReferenceId).toBeNull();
    expect(state.uploaded).toEqual(original);
    await page.getByLabel('Image saved · details', { exact: true }).click();
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
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  release();
  await expect(page.getByLabel('Image upload and verification')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toHaveCount(0);
  expect(state.uploads).toBe(0);
  expect(state.complete).toBe(0);
});
test('cancelling New keeps an in-flight attachment on the current conversation', async ({
  page,
}) => {
  const { state, original, release } = await setup(page, { holdPrepare: true });
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'keep-context.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByLabel('Image upload and verification')).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByLabel('Image upload and verification')).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
  expect(state.uploads).toBe(1);
});
test('attachment-only New is confirmed and cancelling keeps the image', async ({ page }) => {
  const { original } = await setup(page);
  await page
    .getByLabel('Choose image for Talk')
    .setInputFiles({ name: 'keep-only.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeVisible();
  await expect(page.getByAltText('Image attachment: keep-only.png')).toBeVisible();
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

test('saved-version deep links override persisted references and every submitted source matches the preview', async ({
  page,
}) => {
  const { state } = await setup(page, { generation: true });
  state.brief.referenceId = reference;
  const studio = `http://127.0.0.1:3102/app/studio?mode=studio-reference&project=${project}`;
  await page.goto(`${studio}&version=${version}`);
  const source = page.getByAltText('Selected source');
  for (let reload = 0; reload < 2; reload++) {
    if (reload) await page.reload();
    await expect(page.getByText('Developing this saved version', { exact: true })).toBeVisible();
    await expect(source).toHaveAttribute('src', `/api/studio/image?id=${version}&kind=version`);
    await page
      .getByLabel('Describe what you want to see', { exact: true })
      .fill('Refine the displayed saved version only');
    await page.getByRole('button', { name: 'Create image', exact: true }).click();
    await expect.poll(() => state.generationRequests.length).toBe(reload + 1);
    expect(state.generationRequests.at(-1)).toMatchObject({ parentId: version, referenceId: null });
    await expect(page.getByRole('button', { name: 'Create image', exact: true })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /Use reference/ }).click();
  await expect(page.getByText('Using this reference', { exact: true })).toBeVisible();
  await expect(source).toHaveAttribute('src', `/api/studio/image?id=${reference}&kind=reference`);
  await page
    .getByLabel('Describe what you want to see', { exact: true })
    .fill('Use the displayed reference only');
  await page.getByRole('button', { name: 'Create image', exact: true }).click();
  await expect.poll(() => state.generationRequests.length).toBe(3);
  expect(state.generationRequests.at(-1)).toMatchObject({ parentId: null, referenceId: reference });
  await expect(page.getByRole('button', { name: 'Create image', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /Refine this/ }).click();
  await expect(source).toHaveAttribute('src', `/api/studio/image?id=${version}&kind=version`);
  await page
    .getByLabel('Describe what you want to see', { exact: true })
    .fill('Switch back to the saved version');
  await page.getByRole('button', { name: 'Create image', exact: true }).click();
  await expect.poll(() => state.generationRequests.length).toBe(4);
  expect(state.generationRequests.at(-1)).toMatchObject({ parentId: version, referenceId: null });
  // A dedicated handoff takes precedence even when a version query is also present.
  await page.goto(`${studio}&version=${version}&reference=${reference}`);
  await expect(page.getByText('Using this reference', { exact: true })).toBeVisible();
  await page.reload();
  await expect(source).toHaveAttribute('src', `/api/studio/image?id=${reference}&kind=reference`);
  await page
    .getByLabel('Describe what you want to see', { exact: true })
    .fill('Keep the explicit handoff source');
  await page.getByRole('button', { name: 'Create image', exact: true }).click();
  await expect.poll(() => state.generationRequests.length).toBe(5);
  expect(state.generationRequests.at(-1)).toMatchObject({ parentId: null, referenceId: reference });
  // These POSTs are intercepted synthetic rejections, never provider calls.
});

for (const viewport of [
  { width: 390, height: 844, keyboard: 460 },
  { width: 768, height: 712, keyboard: 420 },
]) {
  test(`attachment leaves a readable transcript and pointer-reachable controls at ${viewport.width}px, including keyboard height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const { original, state } = await setup(page, { history: true });
    const input = page.getByLabel('Message Aethelios', { exact: true });
    const choose = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add image', exact: true }).click();
    await (
      await choose
    ).setFiles({ name: 'original-logo.png', mimeType: 'image/png', buffer: original });
    await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toBeEnabled();
    const transcript = page.locator('.conversation-scroll');
    const composer = page.locator('.aurelius-composer');
    const details = page.getByLabel('Image attached · details', { exact: true });
    async function usable(minTranscript: number) {
      await expect
        .poll(async () => (await transcript.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(minTranscript);
      expect((await composer.boundingBox())!.height).toBeLessThan(280);
      expect(await transcript.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      for (const control of [
        input,
        page.getByRole('button', { name: 'Send', exact: true }),
        page.getByRole('button', { name: 'Remove image', exact: true }),
        page.getByRole('button', { name: 'Use in Studio', exact: true }),
      ]) {
        const box = (await control.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        await expect
          .poll(() =>
            control.evaluate((node) => {
              const box = node.getBoundingClientRect();
              const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
              return `${node.getAttribute('aria-label') || node.textContent || node.tagName}|${hit?.tagName}:${hit?.className}|${hit === node || node.contains(hit)}`;
            }),
          )
          .toMatch(/\|true$/);
      }
    }
    await usable(180);
    await input.fill('Keep this conversation readable while an image is attached');
    await page.setViewportSize({ width: viewport.width, height: viewport.keyboard });
    await expect(page.locator('[data-keyboard="open"]')).toBeVisible();
    await page.screenshot({
      path: `test-results/talk-image-keyboard-${viewport.width}.png`,
      fullPage: true,
    });
    await usable(96);
    await details.click();
    await expect(
      page.getByText('Inline Talk generation does not use this image or logo.', { exact: false }),
    ).toBeVisible();
    expect(
      (await page.locator('.talk-image-explanation').boundingBox())!.height,
    ).toBeLessThanOrEqual(viewport.keyboard * 0.16 + 1);
    await details.click();
    await usable(96);
    const latestReply = page.getByText(
      'Saved conversation response 8: keep the original logo and review the direction.',
      { exact: true },
    );
    await latestReply.scrollIntoViewIfNeeded();
    await expect(latestReply).toBeInViewport({ ratio: 0.5 });
    await usable(96);
    await page.screenshot({
      path: `test-results/talk-image-keyboard-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => state.chats.length).toBe(1);
    expect(state.chats[0]).toMatchObject({ attachmentId: reference });
    await expect(page.getByLabel('Image saved · details', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use in Studio', exact: true }).click();
    await expect.poll(() => state.handoffs).toBe(1);
    await page.getByRole('button', { name: 'Remove image', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use in Studio', exact: true })).toHaveCount(0);
    expect(state.generations).toBe(0);
  });
}
