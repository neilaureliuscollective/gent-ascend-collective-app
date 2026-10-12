import { expect, test } from '@playwright/test';

// Read-only, signed-out requests against the real public deployment.
// No model calls, writes, credentials, auth bypass or fabricated ownership.
test('live Studio data and media stay private without an authenticated owner', async ({ request }) => {
  const project = '00000000-0000-4000-8000-000000000000';
  for (const path of [
    '/api/studio',
    `/api/studio/narration?project=${project}`,
    `/api/studio/footage?project=${project}`,
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(401);
    expect(response.headers()['cache-control'], path).toContain('no-store');
    const body = await response.json();
    expect(Object.keys(body), path).toEqual(['error']);
    expect(typeof body.error, path).toBe('string');
  }
  const readiness = await request.get('/api/studio/readiness', { maxRedirects: 0 });
  expect(readiness.status()).toBe(403);
  expect(readiness.headers()['cache-control']).toContain('private');
  expect(readiness.headers()['cache-control']).toContain('no-store');
  expect(await readiness.json()).toEqual({ error: 'Founder access required.' });
  expect((await request.get('/dev', { maxRedirects: 0 })).status()).toBe(404);
});
