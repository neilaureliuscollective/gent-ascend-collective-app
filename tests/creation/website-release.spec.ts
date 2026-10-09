import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { unzipSync, strFromU8 } from 'fflate';
import { creationSetup } from '../../playwright.creation.config';
import {
  assertRuntime,
  protectionHeaders,
  publicAcceptanceKey,
} from '../../scripts/creation-acceptance-scope';

test('normal-login creation, private imagery and exact release survive reload and enforce ownership', async ({
  browser,
}) => {
  const setup = creationSetup(),
    { scope } = setup;
  const clients = setup.logins.map(() =>
    createClient(scope.supabaseUrl, publicAcceptanceKey(setup.key), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  const contexts: BrowserContext[] = [];
  const checks: string[] = [],
    cleanupFailures: string[] = [];
  const projectId = randomUUID(),
    sourceId = randomUUID();
  let stage = 'runtime-binding',
    studioId: string | undefined,
    sourceKey: string | undefined;
  let projectCreated = false,
    passed = false;
  const headers = (path: string) =>
    protectionHeaders(
      scope.origin,
      new URL(path, scope.origin).href,
      process.env.VERCEL_OIDC_TOKEN,
    );
  async function context() {
    const c = await browser.newContext({ baseURL: scope.origin });
    contexts.push(c);
    // Continue the real request. The short-lived protection credential never reaches Supabase or another origin.
    await c.route('**/*', (route) =>
      route.continue({
        headers: { ...route.request().headers(), ...headers(route.request().url()) },
      }),
    );
    return c;
  }
  async function login(page: Page, index: number) {
    await page.goto('/enter');
    await page.getByLabel('Email').fill(setup.logins[index]!.email);
    await page.getByLabel('Password').fill(setup.logins[index]!.password);
    await page.getByRole('button', { name: 'Enter Aethelios' }).click();
    await expect(page).toHaveURL(/\/app\/aethelios$/);
  }
  try {
    const ownerContext = await context();
    const get = (path: string) =>
      ownerContext.request.get(path, { headers: headers(path), maxRedirects: 0 });
    const binding = await get('/api/technology/runtime');
    expect(binding.status()).toBe(200);
    assertRuntime(await binding.json(), scope);
    if (scope.scope === 'isolated-staging') {
      expect((await get('/dev')).status()).toBe(404);
    }
    checks.push(stage);
    stage = 'synthetic-identities';
    const people: { authUserId: string; personId: string }[] = [];
    for (let i = 0; i < 2; i++) {
      const client = clients[i]!;
      expect((await client.auth.signInWithPassword(setup.logins[i]!)).error).toBeNull();
      const identity = await client.auth.getUser();
      expect(identity.error).toBeNull();
      const user = identity.data.user!;
      const person = await client.from('persons').select('id').eq('auth_user_id', user.id).single();
      expect(person.error).toBeNull();
      people.push({ authUserId: user.id, personId: person.data!.id });
    }
    expect(people[0]!.authUserId).not.toBe(people[1]!.authUserId);
    expect(people[0]!.personId).not.toBe(people[1]!.personId);
    if (scope.accounts) expect(people).toEqual(scope.accounts);
    checks.push(stage);
    const owner = clients[0]!;
    stage = 'owned-fixture';
    const studio = await owner
      .from('ai_studio_projects')
      .insert({
        person_id: people[0]!.personId,
        title: 'Synthetic creation acceptance',
        creative_type: 'brand',
      })
      .select('id')
      .single();
    expect(studio.error).toBeNull();
    studioId = studio.data!.id;
    sourceKey = `${people[0]!.authUserId}/${studioId}/${sourceId}.png`;
    const bytes = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#145463' },
    })
      .png()
      .toBuffer();
    expect(
      (
        await owner.storage
          .from('aethelios-studio')
          .upload(sourceKey, bytes, { contentType: 'image/png', upsert: false })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner
          .from('ai_studio_references')
          .insert({
            id: sourceId,
            person_id: people[0]!.personId,
            project_id: studioId,
            storage_key: sourceKey,
            media_type: 'image/png',
            byte_size: bytes.length,
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await owner.rpc('technology_save', {
          p_id: projectId,
          p_version: randomUUID(),
          p_expected: 0,
          p_brief: {
            name: 'Synthetic acceptance site',
            industry: 'professional-services',
            vision: 'A synthetic service website for deployment acceptance.',
            headline: 'Considered work',
            about: 'Synthetic review content.',
            services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
            hours: '',
            contact: '',
            bookingUrl: '',
          },
        })
      ).error,
    ).toBeNull();
    projectCreated = true;
    checks.push(stage);
    stage = 'normal-login-and-image-import';
    const page = await ownerContext.newPage();
    await login(page, 0);
    await page.goto(`/app/work/technology?project=${projectId}`);
    await page.getByText('Website imagery', { exact: true }).click();
    await page.getByLabel('Personal Studio image').selectOption(`reference:${sourceId}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Prepare selected image' }).click();
    await expect(page.getByLabel('Homepage image').locator('option')).toHaveCount(2);
    const imageId = (await page
      .getByLabel('Homepage image')
      .locator('option')
      .nth(1)
      .getAttribute('value'))!;
    await page.getByLabel('Homepage image').selectOption(imageId);
    await page.getByLabel('Image description').fill('Synthetic petrol acceptance image');
    checks.push(stage);
    stage = 'saved-reviewed-build';
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm this saved brief' }).click();
    await page.getByRole('button', { name: 'Prepare website build' }).click();
    await page.getByRole('button', { name: 'Build / resume saved job' }).click();
    const link = page.getByRole('link', { name: 'Download website HTML' });
    await expect(link).toBeVisible();
    const artifactPath = (await link.getAttribute('href'))!,
      artifact = await get(artifactPath),
      html = await artifact.text();
    expect(artifact.status()).toBe(200);
    expect(html).toContain('data:image/jpeg;base64,/9j/');
    expect(html).toContain('alt="Synthetic petrol acceptance image"');
    expect(html).toContain('img-src data:');
    expect(html).not.toContain('/storage/');
    const buildId = new URL(artifactPath, scope.origin).searchParams.get('export')!;
    const publicationPath = `/api/technology/publication?build=${buildId}`;
    expect(await (await get(publicationPath)).json()).toMatchObject({
      projectId,
      revision: 2,
      publishEnabled: false,
      budgetMicros: 0,
      sha256: artifact.headers()['x-artifact-sha256'],
    });
    checks.push(stage);
    stage = 'source-removal-and-reload';
    const imagePath = `/api/technology/images?id=${imageId}`,
      original = await get(imagePath);
    expect(original.status()).toBe(200);
    expect(original.headers()['cache-control']).toBe('private, no-store');
    expect((await owner.storage.from('aethelios-studio').remove([sourceKey])).error).toBeNull();
    expect(await (await get(imagePath)).body()).toEqual(await original.body());
    await page.reload();
    await expect(page.locator('.technology-preview img')).toHaveAttribute('src', imagePath);
    checks.push(stage);
    stage = 'exact-release-package';
    await page.getByRole('button', { name: 'Review release package' }).click();
    await page
      .getByRole('checkbox', {
        name: 'I reviewed this exact build and approve preparing its downloadable files.',
      })
      .check();
    await page.getByRole('button', { name: 'Approve release package' }).click();
    const releaseLink = page.getByRole('link', { name: 'Download release ZIP' });
    await expect(releaseLink).toBeVisible();
    const releasePath = (await releaseLink.getAttribute('href'))!,
      packet = await get(releasePath);
    expect(packet.status()).toBe(200);
    expect(packet.headers()['cache-control']).toBe('private, no-store');
    const files = unzipSync(await packet.body());
    expect(strFromU8(files['index.html']!)).toBe(html);
    expect(JSON.parse(strFromU8(files['manifest.json']!))).toMatchObject({
      revision: 2,
      sha256: artifact.headers()['x-artifact-sha256'],
      publishEnabled: false,
    });
    await page.reload();
    await page.getByRole('button', { name: 'Review release package' }).click();
    await expect(releaseLink).toHaveAttribute('href', releasePath);
    checks.push(stage);
    stage = 'cross-account-and-anonymous-denial';
    const foreign = await context(),
      stranger = await context();
    await login(await foreign.newPage(), 1);
    const paths = [
      imagePath,
      `/api/technology/images?project=${projectId}`,
      artifactPath,
      publicationPath,
      releasePath,
      `/api/technology/releases?build=${buildId}`,
    ];
    for (const path of paths) {
      expect(
        (await foreign.request.get(path, { headers: headers(path), maxRedirects: 0 })).status(),
      ).toBe(404);
      expect(
        (await stranger.request.get(path, { headers: headers(path), maxRedirects: 0 })).status(),
      ).toBe(401);
    }
    checks.push(stage);
    stage = 'revocation';
    await page.getByRole('button', { name: 'Revoke package approval' }).click();
    await expect(page.getByText(/Approval revoked.*Not published/)).toBeVisible();
    expect((await get(releasePath)).status()).toBe(409);
    checks.push(stage);
    passed = true;
  } catch {
    // Playwright's default error values can contain credential fields. Emit only this bounded stage label.
    throw new Error(`Creation acceptance failed at ${stage}. No release approval granted.`);
  } finally {
    const owner = clients[0]!;
    if (sourceKey) {
      try {
        if ((await owner.storage.from('aethelios-studio').remove([sourceKey])).error)
          cleanupFailures.push('source-storage');
      } catch {
        cleanupFailures.push('source-storage');
      }
    }
    if (studioId) {
      try {
        if (
          (
            await owner
              .from('ai_studio_references')
              .delete()
              .eq('id', sourceId)
              .eq('project_id', studioId)
          ).error
        )
          cleanupFailures.push('studio-reference');
        if ((await owner.from('ai_studio_projects').delete().eq('id', studioId)).error)
          cleanupFailures.push('studio-project');
      } catch {
        cleanupFailures.push('studio-records');
      }
    }
    for (const c of contexts) await c.close().catch(() => cleanupFailures.push('browser-context'));
    for (const c of clients) await c.auth.signOut().catch(() => cleanupFailures.push('session'));
    mkdirSync('test-results', { recursive: true });
    // Website records have no owner delete API. Retain only the run's bounded synthetic project for review;
    // the operator removes it by deleting the approved disposable staging branch, never via an admin key here.
    writeFileSync(
      'test-results/public-creation-acceptance.json',
      JSON.stringify(
        {
          contract: 'public-creation-acceptance-v1',
          scope: scope.scope,
          projectRef: scope.projectRef,
          deploymentOrigin: scope.origin,
          candidateTree: scope.candidateTree,
          candidateCommit: scope.candidateCommit,
          observedAt: new Date().toISOString(),
          status: passed && !cleanupFailures.length ? 'passed' : 'failed',
          checks,
          failedStage: passed ? null : stage,
          releaseApproved: false,
          cleanupFailures,
          retainedSyntheticProjectId: projectCreated ? projectId : null,
          retention: 'bounded-synthetic-website-until-disposable-environment-deletion',
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    if (passed && cleanupFailures.length)
      throw new Error('Creation acceptance cleanup incomplete. No release approval granted.');
  }
});
