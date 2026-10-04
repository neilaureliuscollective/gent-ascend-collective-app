import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
import { readGroomingWorld, recordWorldPractice } from '../src/domains/grooming/world';
import { practiceInput } from '../src/domains/grooming/world-model';
import {
  parseRitualSuggestion,
  suggestedRitualKind,
  ritualSteps,
  practiceSummary,
} from '../src/domains/grooming/ritual-model';
const owner = '60000000-0000-4000-8000-000000000001',
  ritual = '65000000-0000-4000-8000-000000000001',
  request = '66000000-0000-4000-8000-000000000001';
let queue: { data: unknown; error: unknown; count?: number }[];
let filters: unknown[];
const rpc = vi.fn(),
  result = (data: unknown, error: unknown = null, count = 0) => ({ data, error, count });
const input = {
  ownerId: owner,
  ritualId: ritual,
  requestId: request,
  version: 2,
  day: '2026-10-04',
};
beforeEach(() => {
  queue = [];
  filters = [];
  rpc.mockReset();
  auth.mockReset();
  const client = {
    rpc,
    from: () => {
      const take = () => Promise.resolve(queue.shift());
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((...args: unknown[]) => {
          filters.push(args);
          return chain;
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: take,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          take().then(resolve, reject),
      };
      return chain;
    },
  };
  auth.mockResolvedValue({ person: { id: owner, timezone: 'America/Chicago' }, client });
});
describe('Daily grooming continuity', () => {
  it('summarizes recorded practice without inventing adherence or interpreting free-text notes', () => {
    expect(practiceSummary([])).toEqual({ days: 0, recorded: 0, effort: 0, irritation: 0 });
    expect(
      practiceSummary([
        { day: '2026-10-02', completed: 2, notes: ['Comfortable', 'Too much effort'] },
        { day: '2026-10-03', completed: 0, notes: [] },
        { day: '2026-10-04', completed: 1, notes: ['Something irritated', 'Irritated? Maybe.'] },
      ]),
    ).toEqual({ days: 2, recorded: 3, effort: 1, irritation: 1 });
  });
  it('loads private rituals, real product links and bounded practice separately from guests', async () => {
    const at = new Date().toISOString();
    queue.push(
      result([
        { id: ritual, kind: 'morning', title: 'My beard', steps: 'Cleanse\nStyle', version: 2 },
      ]),
      result([]),
      result({ occurred_at: at }),
      result(
        [{ id: request, name: 'External beard oil', relation: 'in_use', note: 'My choice' }],
        null,
        1,
      ),
    );
    const data = await readGroomingWorld();
    expect(data).toMatchObject({
      mode: 'personal',
      ownerId: owner,
      rituals: [
        { lastRecordedAt: at, productCount: 1, products: [{ name: 'External beard oil' }] },
      ],
    });
    expect(filters.filter((f) => (f as string[])[0] === 'person_id')).toHaveLength(4);
    auth.mockResolvedValueOnce(null);
    expect(await readGroomingWorld()).toEqual({ mode: 'guest' });
  });
  it('reports read failure rather than presenting empty personal history', async () => {
    queue.push(result(null, { message: 'private details' }), result([]));
    await expect(readGroomingWorld()).rejects.toMatchObject({ status: 503 });
  });
  it('uses the caller session, exact displayed version and immutable request', async () => {
    rpc.mockResolvedValue(
      result({ id: request, ritualId: ritual, occurredAt: '2026-10-04T16:00:00Z' }),
    );
    expect(await recordWorldPractice(input)).toMatchObject({ requestId: request, id: request });
    expect(rpc).toHaveBeenCalledWith('grooming_record_practice', {
      p_request: request,
      p_ritual: ritual,
      p_version: 2,
      p_day: '2026-10-04',
      p_note: '',
    });
  });
  it('accepts an authoritative prior daily completion without treating it as a request mismatch', async () => {
    rpc.mockResolvedValue(
      result({ id: owner, ritualId: ritual, occurredAt: '2026-10-04T16:00:00Z' }),
    );
    expect(await recordWorldPractice(input)).toMatchObject({ id: owner, requestId: request });
  });
  it('denies signed-out/account-changed writes and redacts provider errors', async () => {
    auth.mockResolvedValueOnce(null);
    await expect(recordWorldPractice(input)).rejects.toMatchObject({ status: 401 });
    await expect(recordWorldPractice({ ...input, ownerId: request })).rejects.toMatchObject({
      status: 409,
    });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue(result(null, { code: '40001', message: 'sensitive' }));
    await expect(recordWorldPractice(input)).rejects.toMatchObject({ status: 409 });
    rpc.mockResolvedValue(result(null, { code: 'unknown', message: 'sensitive' }));
    await expect(recordWorldPractice(input)).rejects.toMatchObject({ status: 503 });
  });
  it('rejects missing versions and privilege-shaped extra fields', () => {
    expect(practiceInput.safeParse({ ...input, version: undefined }).success).toBe(false);
    expect(practiceInput.safeParse({ ...input, person_id: owner }).success).toBe(false);
  });
  it('suggests the member local ritual with immediate override available', () => {
    expect(suggestedRitualKind(new Date('2026-10-04T13:00:00Z'), 'America/Chicago')).toBe(
      'morning',
    );
    expect(suggestedRitualKind(new Date('2026-10-04T23:00:00Z'), 'America/Chicago')).toBe(
      'evening',
    );
    expect(suggestedRitualKind(new Date('2026-10-04T23:00:00Z'), 'Asia/Tokyo')).toBe('morning');
    expect(ritualSteps('One\n\n Two ')).toEqual(['One', 'Two']);
  });
  it('offers review only for one complete, bounded structured suggestion', () => {
    const draft = {
      kind: 'morning',
      title: 'My beard ritual',
      steps: 'Cleanse\nFollow my label directions',
      reason: 'Keep it familiar',
    };
    const text = 'A practical refinement.\n```grooming-ritual\n' + JSON.stringify(draft) + '\n```';
    expect(parseRitualSuggestion(text)).toEqual(draft);
    expect(parseRitualSuggestion(text + text)).toBeNull();
    expect(parseRitualSuggestion('```grooming-ritual\n{"steps":"oops"}\n```')).toBeNull();
    expect(parseRitualSuggestion(text.replace('morning', 'clinical'))).toBeNull();
  });
});
