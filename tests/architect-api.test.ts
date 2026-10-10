import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
const generate = vi.hoisted(() => vi.fn());
vi.mock('@/domains/architect/service', () => ({
  listProjects: async () => ({ projects: [] }),
  readProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  generateProject: generate,
}));
import { GET, POST } from '@/app/api/architect/route';
describe('Architect API mutation boundaries', () => {
  it('rejects cross-origin, invalid identifiers, extra owner fields and missing explicit consent without generation', async () => {
    const base = {
      action: 'generate',
      projectId: '20000000-0000-4000-8000-000000000001',
      requestId: '30000000-0000-4000-8000-000000000001',
      expected: 1,
      instruction: 'Build a website',
      consent: true,
    };
    for (const [body, origin, status] of [
      [base, 'https://other.example', 403],
      [{ ...base, projectId: 'invalid' }, 'https://app.example', 400],
      [{ ...base, personId: 'victim' }, 'https://app.example', 400],
      [{ ...base, consent: false }, 'https://app.example', 400],
    ] as const) {
      const response = await POST(
        new Request('https://app.example/api/architect', {
          method: 'POST',
          headers: { host: 'app.example', origin, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(generate).not.toHaveBeenCalled();
  });
  it('strictly validates read parameters', async () => {
    expect(
      (await GET(new Request('https://app.example/api/architect?personId=other'))).status,
    ).toBe(400);
  });
});
