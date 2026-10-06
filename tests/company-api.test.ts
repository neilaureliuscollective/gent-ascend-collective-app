import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/identity/current', () => ({ currentIdentity: async () => null }));
vi.mock('../src/domains/person/current', () => ({ currentPerson: async () => null }));
import { GET as companiesGet, POST as companiesPost } from '../src/app/api/companies/route';
import { GET as talkGet } from '../src/app/api/company-talk/route';
import { POST as talkPost } from '../src/app/api/company-talk/chat/route';
const companyId = 'c8000000-0000-4000-8000-000000000001';
function request(path: string, body: unknown, origin = 'https://aethelios.test') {
  return new Request(`https://aethelios.test${path}`, {
    method: 'POST',
    headers: { origin, host: 'aethelios.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
describe('company API fails closed', () => {
  it('requires a verified identity for reads and valid writes', async () => {
    const responses = [
      await companiesGet(),
      await companiesPost(
        request('/api/companies', {
          id: companyId,
          name: 'Synthetic company',
          brief: '',
          version: 0,
        }),
      ),
      await talkGet(new Request(`https://aethelios.test/api/company-talk?companyId=${companyId}`)),
      await talkPost(
        request('/api/company-talk/chat', {
          companyId,
          conversationId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          text: 'Create a launch brief',
        }),
      ),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.text()).not.toContain('brief:');
    }
  });
  it('rejects malformed scopes and arbitrary query keys before retrieval', async () => {
    for (const query of [
      'companyId=other-company',
      `companyId=${companyId}&listBefore=bad`,
      `companyId=${companyId}&includeContext=true`,
    ]) {
      expect(
        (await talkGet(new Request(`https://aethelios.test/api/company-talk?${query}`))).status,
      ).toBe(400);
    }
  });
  it('rejects personal context, forged ownership and cross-origin writes', async () => {
    const chat = {
      companyId,
      conversationId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      text: 'Build',
    };
    expect(
      (await talkPost(request('/api/company-talk/chat', { ...chat, includeContext: true }))).status,
    ).toBe(400);
    expect(
      (
        await companiesPost(
          request('/api/companies', {
            id: companyId,
            name: 'Synthetic',
            brief: '',
            version: 0,
            person_id: 'forged',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await talkPost(request('/api/company-talk/chat', chat, 'https://hostile.test'))).status,
    ).toBe(403);
  });
});
