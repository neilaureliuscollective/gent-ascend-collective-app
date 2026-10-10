import { afterEach, describe, expect, it, vi } from 'vitest';
import { releaseReadiness, supportEmail } from '../src/domains/release/model';
import { performancePayload, performanceEvent } from '../src/domains/release/performance';
import { POST } from '../src/app/api/monitoring/performance/route';
const founder = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: founder }));
vi.mock('@/domains/release/saved-work-service', () => ({
  probeSavedWork: vi.fn(async () => ({ checkedAt: '2026-10-08T17:00:00.000Z', checks: [] })),
}));
import { readReleaseReadiness } from '../src/domains/release/service';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('release evidence boundary', () => {
  it('keeps missing configuration blocked and actual acceptance unknown', () => {
    const report = releaseReadiness({});
    expect(report.source).toBeNull();
    expect(report.checks.find((row) => row.name === 'Public account entry')?.status).toBe(
      'blocked',
    );
    expect(report.checks.find((row) => row.name === 'Device acceptance')?.status).toBe('unknown');
    expect(report.checks.find((row) => row.name === 'Public release')?.status).toBe('unknown');
  });
  it('does not promote model configuration or raw environment values into acceptance', () => {
    const report = releaseReadiness({
      OPENAI_API_KEY: 'private-key',
      GENT_SUPPORT_EMAIL: 'help@example.test',
      VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
      GENT_PERFORMANCE_ENABLED: 'true',
    });
    expect(report.source).toBe('a'.repeat(40));
    expect(report.checks.find((row) => row.name === 'Member research')?.status).toBe('configured');
    expect(report.checks.find((row) => row.name === 'Public release')?.status).toBe('unknown');
    expect(JSON.stringify(report)).not.toMatch(/private-key|help@example/);
    expect(supportEmail({ GENT_SUPPORT_EMAIL: 'help@example.test?body=secret' })).toBeNull();
    expect(supportEmail({ MEMBERSHIP_SUPPORT_EMAIL: 'help@example.test' })).toBe(
      'help@example.test',
    );
    expect(releaseReadiness({ VERCEL_GIT_COMMIT_SHA: 'private-value' }).source).toBeNull();
  });
  it('does not expose configuration to a member without founder authority', async () => {
    founder.mockResolvedValue(false);
    expect(await readReleaseReadiness()).toBeNull();
    founder.mockResolvedValue(true);
    expect((await readReleaseReadiness())?.checks.length).toBeGreaterThan(0);
  });
});

describe('anonymous performance reporting', () => {
  const request = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://example.test/api/monitoring/performance', {
      method: 'POST',
      headers: { origin: 'https://example.test', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const scalar = { name: 'LCP', value: 2200, surface: 'intelligence', viewport: 'compact' };
  it('projects only scalar categories, never paths, identifiers or DOM attribution', () => {
    const payload = performancePayload(
      { name: 'INP', value: 125.12345 },
      '/app/aethelios/private-conversation-id',
      360,
    );
    expect(payload).toEqual({
      name: 'INP',
      value: 125.123,
      surface: 'intelligence',
      viewport: 'compact',
    });
    expect(performanceEvent.safeParse({ ...scalar, person: 'private-person' }).success).toBe(false);
    expect(performancePayload({ name: 'FCP', value: 1 }, '/', 1440)).toBeNull();
    expect(performancePayload({ name: 'CLS', value: -1 }, '/', 1440)).toBeNull();
    expect(performancePayload({ name: 'CLS', value: Infinity }, '/', 1440)).toBeNull();
  });
  it('keeps collection off by default and suppresses privacy signals and hostile origins', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubEnv('GENT_PERFORMANCE_ENABLED', 'false');
    expect((await POST(request(scalar))).status).toBe(404);
    vi.stubEnv('GENT_PERFORMANCE_ENABLED', 'true');
    expect((await POST(request(scalar, { origin: 'https://attacker.test' }))).status).toBe(403);
    expect((await POST(request(scalar, { 'sec-gpc': '1' }))).status).toBe(202);
    expect((await POST(request(scalar, { dnt: '1' }))).status).toBe(202);
    expect(log).not.toHaveBeenCalled();
  });
  it('bounds streamed input and rejects arbitrary extra fields before logging', async () => {
    vi.stubEnv('GENT_PERFORMANCE_ENABLED', 'true');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect((await POST(request({ ...scalar, query: 'private prompt' }))).status).toBe(400);
    expect((await POST(request({ name: 'x'.repeat(1000) }))).status).toBe(413);
    expect(log).not.toHaveBeenCalled();
    const response = await POST(request(scalar));
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(log).toHaveBeenCalledWith('gent_performance', { ...scalar, release: null });
  });
});
