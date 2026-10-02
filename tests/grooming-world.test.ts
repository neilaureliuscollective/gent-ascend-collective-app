import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
vi.mock('../src/domains/grooming/service', () => ({
  GroomingError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import { readGroomingWorld, recordWorldPractice } from '../src/domains/grooming/world';
import { practiceInput } from '../src/domains/grooming/world-model';
import { localDay } from '../src/domains/daily/model';
const owner = '60000000-0000-4000-8000-000000000001',
  ritual = '65000000-0000-4000-8000-000000000001',
  request = '66000000-0000-4000-8000-000000000001';
const input = () => ({
  ownerId: owner,
  ritualId: ritual,
  requestId: request,
  day: localDay(new Date(), 'America/Chicago'),
});
const stored = {
  id: request,
  ritual_id: ritual,
  done: true,
  note: '',
  occurred_at: new Date().toISOString(),
};
let queue: { data: unknown; error: unknown }[];
let writes: unknown[], filters: unknown[], tables: string[];
const result = (data: unknown, error: unknown = null) => ({ data, error });
beforeEach(() => {
  queue = [];
  writes = [];
  filters = [];
  tables = [];
  const client = {
    from: (table: string) => {
      tables.push(table);
      const take = () => {
        const next = queue.shift();
        if (!next) throw new Error('Unexpected query');
        return Promise.resolve(next);
      };
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((...args: unknown[]) => {
          filters.push(args);
          return chain;
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: take,
        single: take,
        insert: vi.fn((value: unknown) => {
          writes.push(value);
          return chain;
        }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          take().then(resolve, reject),
      };
      return chain;
    },
  };
  auth.mockReset();
  auth.mockResolvedValue({ person: { id: owner, timezone: 'America/Chicago' }, client });
});
describe('Grooming world continuity', () => {
  it('loads only active rituals and their owner-bound latest completion', async () => {
    queue.push(
      result([
        { id: ritual, kind: 'morning', title: 'Morning standard', steps: 'One\nTwo', version: 2 },
      ]),
      result({ occurred_at: stored.occurred_at }),
    );
    const data = await readGroomingWorld();
    expect(data).toMatchObject({
      mode: 'personal',
      ownerId: owner,
      rituals: [{ lastRecordedAt: stored.occurred_at }],
    });
    expect(tables).toEqual(['grooming_rituals', 'grooming_checkins']);
    expect(filters.filter((f) => (f as string[])[0] === 'person_id')).toEqual([
      ['person_id', owner],
      ['person_id', owner],
    ]);
  });
  it('distinguishes guest, empty rituals and a failed history read', async () => {
    auth.mockResolvedValueOnce(null);
    expect(await readGroomingWorld()).toEqual({ mode: 'guest' });
    queue.push(result([]));
    expect(await readGroomingWorld()).toMatchObject({ mode: 'personal', rituals: [] });
    queue.push(result(null, { message: 'private database detail' }));
    await expect(readGroomingWorld()).rejects.toMatchObject({ status: 503 });
  });
  it('records exactly the displayed ritual using the caller session', async () => {
    queue.push(result(null), result({ id: ritual }), result(stored));
    await expect(recordWorldPractice(input())).resolves.toEqual({
      id: request,
      ritualId: ritual,
      occurredAt: stored.occurred_at,
    });
    expect(writes).toEqual([
      { id: request, person_id: owner, ritual_id: ritual, done: true, note: '' },
    ]);
  });
  it('returns the existing receipt on retry, including after the local date changes', async () => {
    queue.push(result(stored));
    await expect(recordWorldPractice({ ...input(), day: '2020-01-01' })).resolves.toMatchObject({
      id: request,
    });
    expect(writes).toEqual([]);
  });
  it('resolves concurrent attempts through the existing unique record ID', async () => {
    queue.push(
      result(null),
      result({ id: ritual }),
      result(null, { code: '23505' }),
      result(stored),
    );
    await expect(recordWorldPractice(input())).resolves.toMatchObject({ id: request });
    expect(writes).toHaveLength(1);
  });
  it('rejects sign-out, changed owner, stale day and retired ritual', async () => {
    auth.mockResolvedValueOnce(null);
    await expect(recordWorldPractice(input())).rejects.toMatchObject({ status: 401 });
    await expect(recordWorldPractice({ ...input(), ownerId: ritual })).rejects.toMatchObject({
      status: 409,
    });
    queue.push(result(null));
    await expect(recordWorldPractice({ ...input(), day: '2020-01-01' })).rejects.toMatchObject({
      status: 409,
    });
    queue.push(result(null), result(null));
    await expect(recordWorldPractice(input())).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual([]);
  });
  it('does not accept a reused ID for a different ritual or uncertain storage', async () => {
    queue.push(result({ ...stored, ritual_id: owner }));
    await expect(recordWorldPractice(input())).rejects.toMatchObject({ status: 409 });
    queue.push(result(null), result({ id: ritual }), result(null, { code: 'unavailable' }));
    await expect(recordWorldPractice(input())).rejects.toMatchObject({ status: 503 });
  });
  it('rejects extra fields and malformed identifiers at the request boundary', () => {
    expect(practiceInput.safeParse({ ...input(), person_id: owner }).success).toBe(false);
    expect(practiceInput.safeParse({ ...input(), ritualId: 'not-an-id' }).success).toBe(false);
  });
});
