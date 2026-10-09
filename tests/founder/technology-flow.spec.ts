// Real local Next API + Supabase acceptance. No intercepted API or model call.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Local Supabase required');
test('Technology survives real save/review/revision/reload and another account cannot read or create it', async ({
  page,
  browser,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app/aethelios');
  await page.goto('/app/work/technology');
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic Technology Studio');
  await page
    .getByLabel('Your vision')
    .fill('A synthetic service-business website for local acceptance.');
  await page.getByLabel('Headline', { exact: true }).fill('Care with intention');
  await page.getByLabel('About your business').fill('A synthetic studio for local testing only.');
  await page.getByLabel('Service 1', { exact: true }).fill('Consultation');
  await page.getByLabel('Price as displayed').fill('$45');
  await page.getByText('Design direction', { exact: true }).click();
  await page.getByLabel('Website palette').selectOption('ivory');
  await page.getByLabel('Hero composition').selectOption('split');
  await page.getByText('Additional pages', { exact: true }).click();
  await page.getByRole('button', { name: 'Add informational page' }).click();
  await page.getByLabel('Page 1 title', { exact: true }).fill('Our process');
  await page.getByLabel('Page 1 address').fill('our-process');
  await page.getByLabel('Page 1 layout').selectOption('cards');
  await page.getByLabel('Page 1 section 1 heading').fill('Discuss your needs');
  await page
    .getByLabel('Page 1 section 1 text')
    .fill('A synthetic conversation about service requirements.');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm this saved brief' }).click();
  await expect(page.getByText('Exact saved version reviewed by you')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare website build' }).click();
  await page.getByRole('button', { name: 'Build / resume saved job' }).click();
  const download = page.getByRole('link', { name: 'Download website HTML' });
  await expect(download).toBeVisible();
  const exportPath = (await download.getAttribute('href'))!;
  const artifact = await page.request.get(exportPath);
  expect(artifact.ok()).toBe(true);
  expect(artifact.headers()['cache-control']).toBe('private, no-store');
  const html = await artifact.text();
  expect(html).toContain('Synthetic Technology Studio');
  expect(html).toContain('id="our-process"');
  expect(html).toContain('href="#our-process"');
  expect(html).toContain('page-sections cards');
  expect(html).toContain('background:#f5f1e8');
  expect(html).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
  const buildList = await (await page.request.get('/api/technology/builds')).json();
  const buildId = buildList.builds[0].id;
  await page.getByRole('button', { name: 'Inspect isolated website' }).click();
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Care with intention' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close website inspection' }).click();
  await page.getByLabel('Headline', { exact: true }).fill('A considered beginning');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByText('Saved brief needs your review')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Synthetic Technology Studio · v2', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('A considered beginning');
  const response = await page.request.get('/api/technology');
  expect(response.ok()).toBe(true);
  const owned = await response.json();
  const version = owned.versions.find(
    (v: { brief: { name: string }; revision: number }) =>
      v.brief.name === 'Synthetic Technology Studio' && v.revision === 2,
  );
  expect(version).toBeTruthy();
  expect(version.brief.pages[0].title).toBe('Our process');
  expect(version.brief.design.palette).toBe('ivory');
  expect(version.brief.design.hero).toBe('split');
  await page.goto('/app/library');
  await expect(page.getByRole('link', { name: /Synthetic Technology Studio/ })).toBeVisible();
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:3103' });
  try {
    const member = await other.newPage();
    await member.goto('/enter');
    await member.getByLabel('Email').fill('member@aurelius.test');
    await member.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
    await member.getByRole('button', { name: 'Enter Aethelios' }).click();
    await expect(member).toHaveURL(/\/app\/aethelios$/);
    const hidden = await member.request.get('/api/technology');
    expect(hidden.ok()).toBe(true);
    const workspace = await hidden.json();
    expect(workspace.canCreate).toBe(false);
    expect(workspace.projects.some((p: { id: string }) => p.id === version.project_id)).toBe(false);
    expect(workspace.versions.some((v: { id: string }) => v.id === version.id)).toBe(false);
    const denied = await member.request.post('/api/technology', {
      headers: { Origin: 'http://127.0.0.1:3103' },
      data: {
        action: 'save',
        id: version.project_id,
        versionId: crypto.randomUUID(),
        expected: 2,
        brief: version.brief,
      },
    });
    expect(denied.status()).toBe(409);
    expect((await (await member.request.get('/api/technology/builds')).json()).builds).toHaveLength(
      0,
    );
    expect((await member.request.get(exportPath)).status()).toBe(404);
    expect(
      (
        await member.request.post('/api/technology/builds', {
          headers: { Origin: 'http://127.0.0.1:3103' },
          data: { action: 'resume', id: buildId },
        })
      ).status(),
    ).toBe(409);
    await member.goto('/app/work/technology');
    await expect(
      member.getByText(
        'Technology creation is an invited pilot. Your membership does not grant this capability.',
      ),
    ).toBeVisible();
    await expect(member.getByLabel('Business name', { exact: true })).toBeDisabled();
  } finally {
    await other.close();
  }
});

// Real local Auth/PostgREST receipt. Synthetic reply; no provider execution.
test('website Talk context and planning proposal persist with real Auth and reject another account', async ({
  page,
}) => {
  const { createClient } = await import('@supabase/supabase-js');
  const owner = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      auth: { persistSession: false },
    },
  );
  const other = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      auth: { persistSession: false },
    },
  );
  expect(
    (
      await owner.auth.signInWithPassword({
        email: 'founder@aurelius.test',
        password: env.AURELIUS_FOUNDER_PASSWORD!,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await other.auth.signInWithPassword({
        email: 'member@aurelius.test',
        password: env.AURELIUS_FOUNDER_PASSWORD!,
      })
    ).error,
  ).toBeNull();
  const person = (await owner.from('persons').select('id').single()).data!;
  const chat = crypto.randomUUID(),
    turn = crypto.randomUUID(),
    mission = crypto.randomUUID(),
    project = crypto.randomUUID(),
    version = crypto.randomUUID();
  const brief = {
    name: 'Synthetic Planning Studio',
    industry: 'professional-services',
    vision: 'A synthetic conversational business website.',
    headline: 'A considered approach',
    about: 'A synthetic professional studio for testing.',
    services: [{ name: 'Consultation', description: '', price: '' }],
    hours: '',
    contact: '',
    bookingUrl: '',
  };
  expect(
    (
      await owner.rpc('ai_begin_turn', {
        p_conversation: chat,
        p_request: turn,
        p_text: 'Propose a website brief',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'synthetic:website-planning-v1',
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner.from('intelligence_missions').insert({
        id: mission,
        person_id: person.id,
        conversation_id: chat,
        title: 'Synthetic Website Planning',
        objective: brief.vision,
        status: 'active',
        decisions: '',
        open_questions: '',
        next_actions: '',
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner.rpc('technology_save', {
        p_id: project,
        p_version: version,
        p_expected: 0,
        p_brief: brief,
        p_mission: mission,
        p_mission_revision: 1,
      })
    ).error,
  ).toBeNull();
  const args = { p_turn: turn, p_project: project, p_revision: 1 };
  const captured = await owner.rpc('technology_capture_context', args);
  expect(captured.error).toBeNull();
  expect(captured.data).toMatchObject({ revision: 1, versionId: version, brief });
  expect((await other.rpc('technology_capture_context', args)).error).not.toBeNull();
  expect(
    (await owner.rpc('technology_capture_context', { ...args, p_revision: 2 })).error,
  ).not.toBeNull();
  expect(
    (await other.from('technology_turn_context').select('*').eq('turn_id', turn)).data,
  ).toEqual([]);
  expect(
    (
      await owner.rpc('ai_finish_turn', {
        p_request: turn,
        p_text: 'Synthetic proposal.\n```aethelios-website\n' + JSON.stringify(brief) + '\n```',
        p_status: 'complete',
        p_input: 0,
        p_output: 0,
      })
    ).error,
  ).toBeNull();
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app/aethelios');
  const proposalResponse = await page.request.get(
    `/api/technology/proposal?mission=${mission}&turn=${turn}`,
  );
  expect(proposalResponse.ok()).toBe(true);
  await page.goto(`/app/work/technology?mission=${mission}&proposal=${turn}`);
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue(brief.name);
  const proposal = await page.request.get(
    `/api/technology/proposal?mission=${mission}&turn=${turn}`,
  );
  expect(proposal.ok()).toBe(true);
  expect(proposal.headers()['cache-control']).toBe('private, no-store');
  await page.goto(`/app/aethelios?conversation=${chat}&technology=${project}`);
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Include this website brief in my next Talk message' }),
  ).not.toBeChecked();
  const receipt = await owner
    .from('technology_turn_context')
    .select('revision,project_id')
    .eq('turn_id', turn)
    .single();
  expect(receipt.data).toEqual({ revision: 1, project_id: project });
  await owner.auth.signOut();
  await other.auth.signOut();
});

test('owned Studio imagery persists as a private website copy, exports without remote URLs and produces a disabled publication manifest', async ({
  page,
  browser,
}) => {
  const { createClient } = await import('@supabase/supabase-js');
  const sharp = (await import('sharp')).default;
  const owner = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false } },
  );
  expect(
    (
      await owner.auth.signInWithPassword({
        email: 'founder@aurelius.test',
        password: env.AURELIUS_FOUNDER_PASSWORD!,
      })
    ).error,
  ).toBeNull();
  const user = (await owner.auth.getUser()).data.user!;
  const person = (await owner.from('persons').select('id').eq('auth_user_id', user.id).single())
    .data!;
  const studio = await owner
    .from('ai_studio_projects')
    .insert({ person_id: person.id, title: 'Synthetic website imagery', creative_type: 'brand' })
    .select('id')
    .single();
  expect(studio.error).toBeNull();
  const sourceId = crypto.randomUUID(),
    project = crypto.randomUUID(),
    versionId = crypto.randomUUID();
  const key = `${user.id}/${studio.data!.id}/${sourceId}.png`;
  const bytes = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: '#145463' },
  })
    .png()
    .toBuffer();
  expect(
    (await owner.storage.from('aethelios-studio').upload(key, bytes, { contentType: 'image/png' }))
      .error,
  ).toBeNull();
  expect(
    (
      await owner
        .from('ai_studio_references')
        .insert({
          id: sourceId,
          person_id: person.id,
          project_id: studio.data!.id,
          storage_key: key,
          media_type: 'image/png',
          byte_size: bytes.length,
        })
    ).error,
  ).toBeNull();
  const b = {
    name: 'Synthetic imagery site',
    industry: 'professional-services',
    vision: 'A synthetic service website with owned imagery.',
    headline: 'Considered work',
    about: 'A synthetic studio for local testing.',
    services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
    hours: '',
    contact: '',
    bookingUrl: '',
  };
  expect(
    (
      await owner.rpc('technology_save', {
        p_id: project,
        p_version: versionId,
        p_expected: 0,
        p_brief: b,
      })
    ).error,
  ).toBeNull();
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app/aethelios');
  await page.goto(`/app/work/technology?project=${project}`);
  await page.getByText('Website imagery', { exact: true }).click();
  await page.getByLabel('Personal Studio image').selectOption(`reference:${sourceId}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Prepare selected image' }).click();
  await expect(page.getByLabel('Homepage image').locator('option')).toHaveCount(2);
  const image = (await page
    .getByLabel('Homepage image')
    .locator('option')
    .nth(1)
    .getAttribute('value'))!;
  await page.getByLabel('Homepage image').selectOption(image);
  await page.getByLabel('Image description').fill('A synthetic petrol studio image');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm this saved brief' }).click();
  await page.getByRole('button', { name: 'Prepare website build' }).click();
  await page.getByRole('button', { name: 'Build / resume saved job' }).click();
  const download = page.getByRole('link', { name: 'Download website HTML' });
  await expect(download).toBeVisible();
  const path = (await download.getAttribute('href'))!;
  const artifact = await page.request.get(path);
  const html = await artifact.text();
  expect(html).toContain('data:image/jpeg;base64,/9j/');
  expect(html).toContain('alt="A synthetic petrol studio image"');
  expect(html).toContain('img-src data:');
  expect(html).not.toContain('/storage/');
  const original = await page.request.get(`/api/technology/images?id=${image}`);
  expect(original.ok()).toBe(true);
  expect(original.headers()['cache-control']).toBe('private, no-store');
  expect((await owner.storage.from('aethelios-studio').remove([key])).error).toBeNull();
  const retained = await page.request.get(`/api/technology/images?id=${image}`);
  expect(await retained.body()).toEqual(await original.body());
  const build = path.split('export=')[1]!;
  const report = await page.request.get(`/api/technology/publication?build=${build}`);
  expect(report.ok()).toBe(true);
  expect(await report.json()).toMatchObject({
    projectId: project,
    versionId: expect.any(String),
    revision: 2,
    publishEnabled: false,
    budgetMicros: 0,
    sha256: artifact.headers()['x-artifact-sha256'],
  });
  expect((await page.request.post('/api/technology/publication')).status()).toBe(405);
  await page.reload();
  await expect(page.locator('.technology-preview img')).toHaveAttribute(
    'src',
    `/api/technology/images?id=${image}`,
  );
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3103' });
  try {
    const member = await context.newPage();
    await member.goto('/enter');
    await member.getByLabel('Email').fill('member@aurelius.test');
    await member.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
    await member.getByRole('button', { name: 'Enter Aethelios' }).click();
    await expect(member).toHaveURL(/\/app\/aethelios$/);
    expect((await member.request.get(`/api/technology/images?id=${image}`)).status()).toBe(404);
    expect((await member.request.get(`/api/technology/images?project=${project}`)).status()).toBe(
      404,
    );
    expect((await member.request.get(`/api/technology/publication?build=${build}`)).status()).toBe(
      404,
    );
    expect((await member.request.get(path)).status()).toBe(404);
  } finally {
    await context.close();
    await owner.auth.signOut();
  }
});
