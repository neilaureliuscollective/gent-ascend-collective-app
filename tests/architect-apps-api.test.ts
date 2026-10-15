import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/access/founder', () => ({
  currentFounderAccess: async () => false,
}));
vi.mock('@/domains/intelligence/service', () => {
  class IntelligenceError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  }
  return {
    IntelligenceError,
    intelligenceSession: async () => {
      throw new IntelligenceError('Session should not be required after a founder refusal.', 500);
    },
  };
});
import { POST } from '@/app/api/architect-apps/route';
import { notesProposal } from '@/domains/architect-apps/notes-fixture';

const projectId = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000941';
const revisionId = '00000000-0000-4000-8000-000000000942';

function appsRequest(body: Record<string, unknown>) {
  return new Request('https://example.com/api/architect-apps', {
    method: 'POST',
    headers: {
      host: 'example.com',
      origin: 'https://example.com',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function founderPilotEnv() {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', 'true');
  vi.stubEnv('ARCHITECT_APPS_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
}

it('refuses ordinary authenticated owners on propose, approve and start over HTTP', async () => {
  founderPilotEnv();
  const propose = await POST(
    appsRequest({
      action: 'propose',
      projectId,
      requestId,
      expected: 1,
      instruction: 'Create field notes.',
      kind: 'create',
      demo: 'none',
    }),
  );
  expect(propose.status).toBe(403);
  await expect(propose.json()).resolves.toMatchObject({ class: 'permission' });
  const approve = await POST(
    appsRequest({
      action: 'approve',
      projectId,
      requestId: '00000000-0000-4000-8000-000000000943',
      expected: 1,
      approvalHash: 'a'.repeat(64),
      proposal: notesProposal(),
      generation: { mode: 'openai', notes: 'Model-generated application files recorded from the authorized OpenAI adapter.' },
      baseRevision: null,
    }),
  );
  expect(approve.status).toBe(403);
  const start = await POST(
    appsRequest({
      action: 'start',
      projectId,
      revisionId,
      requestId: '00000000-0000-4000-8000-000000000944',
      expected: 1,
      approvalHash: 'a'.repeat(64),
    }),
  );
  expect(start.status).toBe(403);
});

it('keeps executable work closed when the founder pilot flag is off', async () => {
  founderPilotEnv();
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', '');
  const response = await POST(
    appsRequest({
      action: 'propose',
      projectId,
      requestId: '00000000-0000-4000-8000-000000000945',
      expected: 1,
      instruction: 'Create field notes.',
      kind: 'create',
      demo: 'none',
    }),
  );
  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toMatchObject({
    error: expect.stringMatching(/executable work stays off|founder-production app generation stays off/i),
  });
});
