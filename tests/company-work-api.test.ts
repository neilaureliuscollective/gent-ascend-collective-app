import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/identity/current', () => ({ currentIdentity: async () => null }));
vi.mock('../src/domains/person/current', () => ({ currentPerson: async () => null }));
import { GET, POST, PATCH, PUT } from '../src/app/api/company-work/route';
import { POST as visualPost, GET as visualGet } from '../src/app/api/company-work/visual/route';
import { emptyWork } from '../src/domains/company-work/schema';
const companyId = 'd6000000-0000-4000-8000-000000000021',
  jobId = 'd6000000-0000-4000-8000-000000000022',
  versionId = 'd6000000-0000-4000-8000-000000000023';
function request(body: unknown, method = 'POST', origin = 'https://aethelios.test') {
  return new Request('https://aethelios.test/api/company-work', {
    method,
    headers: { origin, host: 'aethelios.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
describe('company work API isolation', () => {
  it('requires real identity for valid job, generation, edit, review, export and visual requests', async () => {
    const responses = [
      await GET(new Request(`https://aethelios.test/api/company-work?companyId=${companyId}`)),
      await GET(
        new Request(
          `https://aethelios.test/api/company-work?companyId=${companyId}&jobId=${jobId}&versionId=${versionId}&format=pdf`,
        ),
      ),
      await POST(
        request({
          companyId,
          jobId,
          requestId: versionId,
          expected: 0,
          instruction: 'Create strategy',
        }),
      ),
      await PATCH(
        request(
          { companyId, jobId, versionId, expected: 0, content: emptyWork('Synthetic') },
          'PATCH',
        ),
      ),
      await PUT(request({ companyId, jobId, versionId }, 'PUT')),
      await visualPost(
        request({
          companyId,
          jobId,
          requestId: versionId,
          prompt: 'Synthetic visual',
          mode: 'fast',
          approved: true,
        }),
      ),
      await visualGet(
        new Request(
          `https://aethelios.test/api/company-work/visual?companyId=${companyId}&jobId=${jobId}&assetId=${versionId}`,
        ),
      ),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });
  it('rejects forged authority, unapproved spend, invalid scopes and cross-origin writes', async () => {
    expect(
      (
        await POST(
          request({
            companyId,
            jobId,
            requestId: versionId,
            expected: 0,
            instruction: 'Draft',
            person_id: 'forged',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await visualPost(
          request({
            companyId,
            jobId,
            requestId: versionId,
            prompt: 'Image',
            mode: 'fast',
            approved: false,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await GET(
          new Request(
            `https://aethelios.test/api/company-work?companyId=${companyId}&includeContext=true`,
          ),
        )
      ).status,
    ).toBe(400);
    expect((await PATCH(request({}, 'PATCH', 'https://hostile.test'))).status).toBe(403);
  });
});
