import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  inspectPlatform,
  inspectionPaths,
  platformEvidence,
} from '../src/domains/founder-office/platform';
afterEach(() => vi.unstubAllGlobals());
describe('canonical public platform observations', () => {
  it('uses only fixed destinations and pins bounded source provenance to the observed commit', async () => {
    const sha = 'a'.repeat(40);
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.cache).toBe('no-store');
      expect(init.redirect).toBe('error');
      expect(init.headers).not.toHaveProperty('authorization');
      if (url === 'https://www.gentascend.com') return new Response(null, { status: 200 });
      if (url.endsWith('/branches/main')) return Response.json({ commit: { sha } });
      if (url.includes('/actions/runs'))
        return Response.json({
          workflow_runs: [
            {
              id: 1,
              name: 'Quality',
              status: 'completed',
              conclusion: 'failure',
              head_sha: sha,
              html_url: `https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/1`,
            },
          ],
        });
      expect(url).toContain(`?ref=${sha}`);
      return Response.json({
        encoding: 'base64',
        content: Buffer.from('Public source excerpt').toString('base64'),
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const snapshot = await inspectPlatform();
    expect(snapshot.commit).toBe(sha);
    expect(snapshot.files.map((file) => file.path)).toEqual([...inspectionPaths]);
    expect(snapshot.workflows[0]?.conclusion).toBe('failure');
    expect(fetcher).toHaveBeenCalledTimes(3 + inspectionPaths.length);
    expect(platformEvidence(snapshot).every((e) => e.detail.length <= 2000)).toBe(true);
    expect(snapshot.limits).toContain('No authenticated app journey');
  });
  it('does not pretend failed network observations are healthy or expose provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('SECRET_NETWORK_RESPONSE');
      }),
    );
    const snapshot = await inspectPlatform();
    expect(snapshot.application.available).toBe(false);
    expect(snapshot.application.status).toBeNull();
    expect(snapshot.commit).toBeNull();
    expect(snapshot.files).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('SECRET_NETWORK_RESPONSE');
  });
  it('rejects oversized public payloads and redirected observations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === 'https://www.gentascend.com'
          ? new Response(null, { status: 302 })
          : new Response('x'.repeat(150001)),
      ),
    );
    const snapshot = await inspectPlatform();
    expect(snapshot.commit).toBeNull();
    expect(snapshot.application.available).toBe(false);
    expect(snapshot.workflowIssue).not.toBeNull();
  });
});
