import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const ready = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      github: {
        ready: boolean;
        repository: { owner: string; name: string; id: number; fullName: string } | null;
        reason: string;
      };
      vercel: { ready: boolean; project: { id: string; name: string } | null; reason: string };
    }> => ({
      github: {
        ready: true,
        repository: { owner: 'acme', name: 'site', id: 1, fullName: 'acme/site' },
        reason: 'Verified read-only GitHub installation for the selected repository.',
      },
      vercel: { ready: false, project: null, reason: 'Vercel is not connected.' },
    }),
  ),
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

import { architectPinnedSource } from '@/domains/connections/architect';
import {
  readConstructConnectionSource,
  verifyConstructGitPin,
} from '@/domains/architect-construct/connections-source';
import { GET } from '@/app/api/architect-construct/source/route';

const pinned = vi.mocked(architectPinnedSource);
const commit = 'a'.repeat(40);

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

it('rejects a claimed Git pin that is not an exact commit', async () => {
  await expect(
    verifyConstructGitPin({
      repository: 'acme/site',
      commit: 'not-an-exact-sha',
      files: [{ path: 'preview.html', content: 'claimed' }],
    }),
  ).rejects.toThrow(/exact commit/);
});

it('rejects a claimed Git pin that does not match the selected repository', async () => {
  await expect(
    verifyConstructGitPin({
      repository: 'other/repo',
      commit,
      files: [{ path: 'preview.html', content: 'claimed' }],
    }),
  ).rejects.toThrow(/does not match the selected owner-authorized repository/);
});

it('rejects a claimed Git pin whose file content does not match the server fetch', async () => {
  pinned.mockResolvedValueOnce({
    path: 'preview.html',
    sha: commit,
    content: 'server-controlled bytes',
  });
  await expect(
    verifyConstructGitPin({
      repository: 'acme/site',
      commit,
      files: [{ path: 'preview.html', content: 'browser-claimed bytes' }],
    }),
  ).rejects.toThrow(/does not match the selected repository pin/);
});

it('rejects a revoked or unready connection without treating the browser digest as proof', async () => {
  ready.mockResolvedValueOnce({
    github: { ready: false, repository: null, reason: 'GitHub authorization was revoked.' },
    vercel: { ready: false, project: null, reason: 'Vercel is not connected.' },
  });
  await expect(
    verifyConstructGitPin({
      repository: 'acme/site',
      commit,
      files: [{ path: 'preview.html', content: 'claimed' }],
    }),
  ).rejects.toThrow(/revoked|required|authorized/i);
});

it('accepts a pin only after the server fetch matches path, SHA and content', async () => {
  pinned.mockResolvedValueOnce({
    path: 'preview.html',
    sha: commit,
    content: 'server-controlled bytes',
  });
  const verified = await verifyConstructGitPin({
    repository: 'acme/site',
    commit,
    files: [{ path: 'preview.html', content: 'server-controlled bytes' }],
  });
  expect(verified.repository).toBe('acme/site');
  expect(verified.commit).toBe(commit);
  expect(verified.files[0]?.content).toBe('server-controlled bytes');
});
