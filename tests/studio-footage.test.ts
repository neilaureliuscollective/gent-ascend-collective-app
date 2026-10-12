import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
import {
  footageBrief,
  footageRange,
  footageItem,
  type FootageJob,
} from '../src/domains/studio/footage';
import { footageMp4 } from '../src/domains/studio/footage-media';
import {
  quoteSignature,
  taskSignature,
  validSignature,
  footageConfigured,
} from '../src/platform/runway/receipts';
import {
  submitFootage,
  inspectFootage,
  footageOutputUrl,
  downloadFootage,
} from '../src/platform/runway/footage';
const id = '10000000-0000-4000-8000-000000000004';
const job = {
  id,
  person_id: id,
  project_id: id,
  title: 'Test',
  prompt: 'A quiet landscape.',
  duration: 5,
  ratio: '1280:720',
  estimate: 60,
  policy: 'runway-gen45-2026-10-12',
  expires_at: '2026-10-12T06:00:00Z',
} as FootageJob;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('Footage approval, integrity and provider boundary', () => {
  it('limits model settings and never accepts caller prices, sources or private provider IDs', () => {
    const brief = {
      projectId: id,
      title: 'Test',
      prompt: job.prompt,
      duration: 5,
      ratio: job.ratio,
    };
    expect(footageBrief.parse(brief)).toEqual(brief);
    for (const extra of [
      { duration: 60 },
      { estimate: 1 },
      { model: 'sora-2' },
      { promptImage: 'https://private' },
      { prompt: 'x'.repeat(1001) },
    ])
      expect(footageBrief.safeParse({ ...brief, ...extra }).success).toBe(false);
  });
  it('attests immutable quotes and task ownership, rejects tampering and strips sensitive fields', () => {
    vi.stubEnv('STUDIO_FOOTAGE_SIGNING_KEY', 'synthetic-receipt-key-at-least-32-characters');
    const signature = quoteSignature(job);
    expect(
      validSignature(
        signature,
        quoteSignature({ ...job, expires_at: '2026-10-12T06:00:00+00:00' }),
      ),
    ).toBe(true);
    for (const change of [
      { prompt: 'Other' },
      { estimate: 1 },
      { person_id: 'other' },
      { duration: 10 as const },
    ])
      expect(validSignature(signature, quoteSignature({ ...job, ...change }))).toBe(false);
    const receipt = taskSignature(job, id);
    expect(validSignature(receipt, taskSignature({ ...job, id: 'other' }, id))).toBe(false);
    expect(validSignature(receipt, taskSignature({ ...job, person_id: 'other' }, id))).toBe(false);
    expect(validSignature('invalid', receipt)).toBe(false);
    expect(
      footageItem({
        ...job,
        provider_signature: receipt,
        provider_id: id,
        quote_signature: signature,
      }),
    ).not.toHaveProperty('provider_id');
    expect(footageConfigured()).toBe(false);
  });
  it('posts once to the active versioned API without retries on uncertain errors', async () => {
    vi.stubEnv('RUNWAYML_API_SECRET', 'fixture-key');
    const fetch = vi.fn().mockResolvedValue(Response.json({ id, estimatedCost: { credits: 60 } }));
    vi.stubGlobal('fetch', fetch);
    expect((await submitFootage(job)).id).toBe(id);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.dev.runwayml.com/v1/text_to_video');
    expect(options.headers['X-Runway-Version']).toBe('2024-11-06');
    expect(JSON.parse(options.body)).toEqual({
      model: 'gen4.5',
      promptText: job.prompt,
      duration: 5,
      ratio: job.ratio,
    });
    fetch.mockReset().mockRejectedValue(new Error('timeout'));
    await expect(submitFootage(job)).rejects.toThrow('timeout');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('requires matching provider identity and exact approved output hosts without forwarding API secrets', async () => {
    vi.stubEnv('RUNWAYML_API_SECRET', 'fixture-key');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: '10000000-0000-4000-8000-000000000005', status: 'RUNNING' }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(inspectFootage(id)).rejects.toThrow('identity');
    for (const url of [
      'http://dnznrvs05pmza.cloudfront.net/a',
      'https://127.0.0.1/a',
      'https://dnznrvs05pmza.cloudfront.net.evil.test/a',
      'https://user:pass@dnznrvs05pmza.cloudfront.net/a',
      'https://dnznrvs05pmza.cloudfront.net:444/a',
    ])
      expect(() => footageOutputUrl(url)).toThrow();
    fetch.mockReset().mockResolvedValue(new Response(new Uint8Array([1, 2])));
    await downloadFootage('https://dnznrvs05pmza.cloudfront.net/output.mp4?token=synthetic');
    expect(fetch.mock.calls[0]![1]).not.toHaveProperty('headers');
    expect(fetch.mock.calls[0]![1].redirect).toBe('error');
  });
  it('validates a real H.264 MP4 and refuses mismatched duration, dimensions and truncation', () => {
    const bytes = Buffer.from(
      readFileSync('tests/fixtures/studio-footage.mp4.base64', 'utf8'),
      'base64',
    );
    expect(footageMp4(bytes, 5, '1280:720').duration).toBe(5);
    expect(() => footageMp4(bytes, 10, '1280:720')).toThrow('match');
    expect(() => footageMp4(bytes, 5, '720:1280')).toThrow('match');
    expect(() => footageMp4(bytes.subarray(0, 100), 5, '1280:720')).toThrow();
    expect(() => footageMp4(new Uint8Array(30_000_001), 5, '1280:720')).toThrow('size');
  });
  it('handles playback byte ranges without multiple, empty or out-of-bounds ranges', () => {
    expect(footageRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(footageRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(footageRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(footageRange(null, 100)).toBeNull();
    for (const header of ['bytes=-', 'bytes=-0', 'bytes=200-', 'bytes=20-10', 'bytes=1-2,3-4'])
      expect(() => footageRange(header, 100)).toThrow();
  });
  it('rejects configured IP/local outputs and oversized provider bodies without exposing their content', async () => {
    vi.stubEnv('STUDIO_FOOTAGE_OUTPUT_HOSTS', '127.0.0.1,[::1],localhost');
    for (const url of ['https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a'])
      expect(() => footageOutputUrl(url)).toThrow('host');
    vi.stubEnv('RUNWAYML_API_SECRET', 'fixture-key');
    const fetch = vi.fn().mockResolvedValue(new Response('private-provider-detail'.repeat(4000)));
    vi.stubGlobal('fetch', fetch);
    await expect(submitFootage(job)).rejects.toThrow('receipt could not be verified');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
