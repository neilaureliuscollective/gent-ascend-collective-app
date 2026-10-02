import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
vi.mock('../src/domains/daily/service', () => ({
  DailyError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { readWorldPriority, saveWorldPriority } from '../src/domains/daily/world-priority';
import { GET, PUT } from '../src/app/api/world/priority/route';
import { localDay } from '../src/domains/daily/model';

const ownerId = '60000000-0000-4000-8000-000000000001';
const day = localDay(new Date(), 'America/Chicago');
const action = {
  id: '61000000-0000-4000-8000-000000000001',
  title: 'Make the call',
  done: false,
  position: 0,
};
let entry: {
  day: string;
  version: number;
  intention: string;
  energy: number;
  sleep_minutes: number;
  reflection: string;
  updated_at: string;
  actions: (typeof action)[];
};
let query: {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  entry = {
    day,
    version: 4,
    intention: 'Build with care',
    energy: 3,
    sleep_minutes: 420,
    reflection: 'Private reflection',
    updated_at: new Date().toISOString(),
    actions: [action],
  };
  query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: entry, error: null })),
  };
  rpc = vi.fn(async (_name, input) => {
    entry = { ...entry, intention: input.p_intention, version: 5 };
    return { data: 5, error: null };
  });
  auth.mockReset();
  auth.mockResolvedValue({
    person: { id: ownerId, timezone: 'America/Chicago' },
    client: { from: vi.fn(() => query), rpc },
  });
});
const input = () => ({ ownerId, day, version: 4, intention: 'Protect the first hour' });
const request = (body: unknown, origin = 'https://gent.test') =>
  new Request('https://gent.test/api/world/priority', {
    method: 'PUT',
    headers: { host: 'gent.test', origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('World priority uses existing owner-bound daily records', () => {
  it('returns a minimal current-day snapshot without wellness or reflection fields', async () => {
    const result = await readWorldPriority();
    expect(query.eq).toHaveBeenCalledWith('person_id', ownerId);
    expect(query.eq).toHaveBeenCalledWith('day', day);
    expect(result).toMatchObject({
      mode: 'personal',
      intention: 'Build with care',
      nextAction: 'Make the call',
    });
    expect(result).not.toHaveProperty('energy');
    expect(result).not.toHaveProperty('reflection');
  });
  it('patches only intention and preserves every other field through the versioned RPC', async () => {
    await expect(saveWorldPriority(input())).resolves.toMatchObject({
      intention: 'Protect the first hour',
      version: 5,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('daily_save', {
      p_day: day,
      p_version: 4,
      p_intention: 'Protect the first hour',
      p_energy: 3,
      p_sleep: 420,
      p_reflection: 'Private reflection',
      p_actions: [{ id: action.id, title: action.title, done: false }],
    });
  });
  it('rejects account switches, stale versions and midnight rollover before writing', async () => {
    for (const changed of [
      { ...input(), ownerId: '60000000-0000-4000-8000-000000000002' },
      { ...input(), version: 3 },
      { ...input(), day: '2020-01-01' },
    ])
      await expect(saveWorldPriority(changed)).rejects.toMatchObject({ status: 409 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('surfaces a race rejected under the database lock without claiming a save', async () => {
    rpc.mockResolvedValue({ error: { code: '40001' } });
    await expect(saveWorldPriority(input())).rejects.toMatchObject({ status: 409 });
  });
  it('does not turn a database outage into an empty priority', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: 'unavailable' } });
    await expect(readWorldPriority()).rejects.toMatchObject({ status: 503 });
  });
  it('keeps guests read-only and all responses private', async () => {
    auth.mockResolvedValue(null);
    const read = await GET();
    expect(await read.json()).toEqual({ mode: 'guest' });
    expect(read.headers.get('cache-control')).toContain('no-store');
    const write = await PUT(request(input()));
    expect(write.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects foreign origins and attempts to mutate extra daily fields', async () => {
    expect((await PUT(request(input(), 'https://foreign.test'))).status).toBe(403);
    expect((await PUT(request({ ...input(), energy: 5 }))).status).toBe(400);
    expect((await PUT(request({ ...input(), intention: 'x'.repeat(161) }))).status).toBe(400);
    expect((await PUT(request({ ...input(), intention: 'x'.repeat(3000) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});
