import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  streamTalkCreationFixture,
  talkCreationFixtureEnabled,
} from '@/domains/talk-creation/fixture-stream';
import { legacyReserveBoard } from '@/domains/talk-creation/design-board';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VERCEL', undefined);
  vi.stubEnv('VERCEL_ENV', undefined);
  vi.stubEnv('AETHELIOS_TALK_CREATION_FIXTURE', 'legacy-reserve');
});
afterEach(() => vi.unstubAllEnvs());
it('allows the labelled fixture only with explicit local development and loopback persistence', () => {
  expect(talkCreationFixtureEnabled()).toBe(true);
  vi.stubEnv('AETHELIOS_TALK_CREATION_FIXTURE', 'lifestyle-launch');
  expect(talkCreationFixtureEnabled()).toBe(true);
  vi.stubEnv('AETHELIOS_TALK_CREATION_FIXTURE', undefined);
  expect(talkCreationFixtureEnabled()).toBe(false);
});
it.each([
  ['NODE_ENV', 'production'],
  ['APP_ENV', 'preview'],
  ['APP_ENV', 'production'],
  ['VERCEL', '1'],
  ['VERCEL_ENV', 'preview'],
  ['NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'],
  ['NEXT_PUBLIC_SUPABASE_URL', 'invalid'],
])('denies the fixture with %s=%s', (name, value) => {
  vi.stubEnv(name, value);
  expect(talkCreationFixtureEnabled()).toBe(false);
});

it('offers the labelled Legacy Reserve board through the Talk creation session', async () => {
  const creation = {
    conversationId: '30000000-0000-4000-8000-000000000031',
    requestId: '40000000-0000-4000-8000-000000000031',
    userText: 'Give me three visual directions for Legacy Reserve.',
    offered: [] as Array<{ board?: ReturnType<typeof legacyReserveBoard> }>,
    images: [],
    selected: {},
    selectedImageId: null,
    completeImageCount: 0,
  };
  const chunks = [];
  for await (const chunk of streamTalkCreationFixture(creation)) chunks.push(chunk);
  expect(creation.offered[0]?.board).toEqual(legacyReserveBoard());
  expect(
    chunks.some(
      (chunk) =>
        chunk.type === 'text' && chunk.text.includes('Labelled deterministic Talk fixture'),
    ),
  ).toBe(true);
});

it('offers a warmer selected direction for a refine request', async () => {
  const creation = {
    conversationId: '30000000-0000-4000-8000-000000000031',
    requestId: '40000000-0000-4000-8000-000000000032',
    userText: 'Make the selected direction warmer.',
    offered: [] as Array<{ board?: ReturnType<typeof legacyReserveBoard> }>,
    images: [],
    selected: { board: '50000000-0000-4000-8000-000000000031' },
    selectedImageId: null,
    completeImageCount: 0,
  };
  const chunks = [];
  for await (const chunk of streamTalkCreationFixture(creation)) chunks.push(chunk);
  expect(chunks.some((chunk) => chunk.type === 'text')).toBe(true);
  const board = creation.offered[0]?.board;
  expect(board?.selectedDirectionId).toBe('direction-c');
  expect(board?.directions.find((item) => item.id === 'direction-a')?.name).toBe(
    'Graphite Chamber',
  );
});
