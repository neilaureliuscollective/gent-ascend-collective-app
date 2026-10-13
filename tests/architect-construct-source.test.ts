import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const ready = vi.hoisted(() =>
  vi.fn(async () => ({
    github: {
      ready: true,
      repository: { owner: 'acme', name: 'site', id: 1, fullName: 'acme/site' },
      reason: 'Verified read-only GitHub installation for the selected repository.',
    },
    vercel: { ready: false, project: null, reason: 'Vercel is not connected.' },
  })),
);
vi.mock('@/domains/connections/architect', () => ({
  architectConnectionReadiness: ready,
  architectPinnedSource: vi.fn(),
}));
vi.mock('@/domains/connections/store', () => ({
  founderConnectionStore: () => ({}),
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: '22222222-2222-4222-8222-222222222222' },
    client: {},
  }),
}));

import { readConstructConnectionSource } from '@/domains/architect-construct/connections-source';
import { GET } from '@/app/api/architect-construct/source/route';

it('exposes read-only selected repository state and never invents publish access', async () => {
  const source = await readConstructConnectionSource();
  expect(source.access).toBe('read-only');
  expect(source.publishing).toBe(false);
  expect(source.deployment).toBe(false);
  expect(source.github.repository?.fullName).toBe('acme/site');
  const response = await GET(new Request('https://example.com/api/architect-construct/source'));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json();
  expect(body.publishing).toBe(false);
  expect(body.github.repository.fullName).toBe('acme/site');
});
