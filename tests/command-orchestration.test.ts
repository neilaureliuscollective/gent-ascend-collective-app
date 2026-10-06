import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock('@/domains/access/authorize', () => ({ authorizedPerson: auth }));
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { adoptPreparedMove, readCommand } from '../src/domains/command/service';
import { commandAuthority } from '../src/domains/command/autonomy';
import { projectCommand } from '../src/domains/command/projection';
import { commandChanges } from '../src/domains/command/changes';
import { GET, POST } from '../src/app/api/command/route';
import {
  localDay,
  daysEnding,
  sampleData,
  emptyDay,
  type DailyData,
} from '../src/domains/daily/model';
const ownerId = '60000000-0000-4000-8000-000000000001';
const today = localDay(new Date(), 'America/Chicago');
const yesterday = daysEnding(today, 2)[0]!;
let entries: Record<string, unknown>[];
let goal: { title: string; next_step: string };
let rpc: ReturnType<typeof vi.fn>;
let filters: [string, string, unknown][];
beforeEach(() => {
  entries = [];
  goal = { title: 'Build a useful company', next_step: 'Call the partner' };
  filters = [];
  rpc = vi.fn(async (_name, input) => {
    entries = [
      {
        day: today,
        timezone: 'America/Chicago',
        version: input.p_version + 1,
        energy: input.p_energy,
        sleep_minutes: input.p_sleep,
        intention: input.p_intention,
        reflection: input.p_reflection,
        actions: input.p_actions.map((a: object, position: number) => ({ ...a, position })),
        updated_at: new Date().toISOString(),
      },
    ];
    return { data: 1, error: null };
  });
  auth.mockReset();
  auth.mockResolvedValue({
    person: { id: ownerId, timezone: 'America/Chicago', display_name: 'Synthetic' },
    client: {
      rpc,
      from(table: string) {
        const query = {
          select() {
            return query;
          },
          eq(key: string, value: unknown) {
            filters.push([table, key, value]);
            return query;
          },
          is(key: string, value: unknown) {
            filters.push([table, key, value]);
            return query;
          },
          gte() {
            return query;
          },
          lte() {
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          maybeSingle() {
            return query;
          },
          then(resolve: (result: object) => unknown) {
            return Promise.resolve({
              error: null,
              data:
                table === 'daily_entries'
                  ? entries
                  : table === 'goals'
                    ? [goal]
                    : table === 'ascend_profile_facts'
                      ? null
                      : [],
              count: 0,
            }).then(resolve);
          },
        };
        return query;
      },
    },
  });
});
const input = () => ({
  ownerId,
  day: today,
  version: 0,
  source: 'goal' as const,
  title: goal.next_step,
  approve: true as const,
});
const request = (body: unknown, origin = 'https://gent.test') =>
  new Request('https://gent.test/api/command', {
    method: 'POST',
    headers: { host: 'gent.test', origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
describe('bounded Command orchestration', () => {
  it('prepares owner-scoped records without any database/model mutation or shared cache', async () => {
    const result = await GET();
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    const snapshot = await result.json();
    expect(snapshot.prepared).toBe(true);
    expect(snapshot.data.ownerId).toBe(ownerId);
    expect(snapshot.opening.move.title).toBe('Call the partner');
    expect(filters.filter(([, key]) => key === 'person_id')).toHaveLength(7);
    expect(
      filters.filter(([, key]) => key === 'person_id').every(([, , owner]) => owner === ownerId),
    ).toBe(true);
    expect(filters).toContainEqual(['ai_conversations', 'company_id', null]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requires deliberate approval and fails closed for unknown/unowned operations', () => {
    expect(commandAuthority('adopt_prepared_move', true).executable).toBe(false);
    expect(commandAuthority('adopt_prepared_move', false, true).executable).toBe(false);
    expect(commandAuthority('adopt_prepared_move', true, true).executable).toBe(true);
    expect(commandAuthority('assemble_briefing', true).executable).toBe(true);
    expect(commandAuthority('send_payment', true, true).executable).toBe(false);
  });
  it('writes only the exact server-prepared move and preserves existing observations', async () => {
    entries = [
      {
        ...emptyDay(today, 'America/Chicago'),
        version: 4,
        energy: 2,
        sleep_minutes: 390,
        intention: 'Keep it simple',
        reflection: 'Private reflection',
      },
    ];
    await adoptPreparedMove({ ...input(), version: 4 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('daily_save', {
      p_day: today,
      p_version: 4,
      p_energy: 2,
      p_sleep: 390,
      p_intention: 'Keep it simple',
      p_reflection: 'Private reflection',
      p_actions: [{ id: expect.any(String), title: 'Call the partner', done: false }],
    });
    // Replaying the old approval cannot create a duplicate action.
    await expect(adoptPreparedMove({ ...input(), version: 4 })).rejects.toMatchObject({
      status: 409,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects stale owner, day, version, changed source and arbitrary client text', async () => {
    for (const patch of [
      { ownerId: '60000000-0000-4000-8000-000000000002' },
      { day: yesterday },
      { version: 9 },
      { source: 'review' as const },
      { title: 'Send a payment' },
    ])
      await expect(adoptPreparedMove({ ...input(), ...patch })).rejects.toMatchObject({
        status: 409,
      });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('cannot overwrite a saved plan or truncate oversized review/goal text', async () => {
    entries = [
      {
        ...emptyDay(today, 'America/Chicago'),
        actions: [{ id: ownerId, title: 'Already planned', done: false, position: 0 }],
      },
    ];
    await expect(adoptPreparedMove(input())).rejects.toMatchObject({ status: 409 });
    entries = [];
    goal.next_step = 'x'.repeat(101);
    const snapshot = await readCommand();
    expect(snapshot.opening.move.title).toHaveLength(101);
    expect(snapshot.opening.canAdopt).toBe(false);
    await expect(adoptPreparedMove(input())).rejects.toMatchObject({ status: 409 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('surfaces a database race as a conflict and does not retry writes', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    await expect(adoptPreparedMove(input())).rejects.toMatchObject({ status: 409 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('denies anonymous, hostile origin, missing approval and injected authority', async () => {
    for (const body of [
      { ...input(), approve: false },
      { ...input(), capability: 'daily.write' },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request(input(), 'https://hostile.test'))).status).toBe(403);
    auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request(input()))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('a completed or reviewed day never manufactures another task', () => {
    const data = sampleData(today);
    data.entries = data.entries.map((entry) => ({
      ...entry,
      actions: entry.actions.map((action) => ({ ...action, done: true })),
    }));
    const result = projectCommand(data);
    expect(result.move.kind).toBe('rest');
    expect(result.canAdopt).toBe(false);
    expect(result.briefing).toContain('saved plan is complete');
  });
  it('compares only successfully loaded snapshots for the same mounted owner/day', () => {
    const before: DailyData = { ...sampleData(today), mode: 'personal', ownerId };
    const after = structuredClone(before);
    after.entries.find((entry) => entry.day === today)!.actions[1]!.done = true;
    expect(commandChanges(before, after)).toEqual(['Your saved plan changed.']);
    expect(commandChanges(before, { ...after, ownerId: 'other' })).toEqual([]);
    expect(commandChanges(before, { ...after, today: '2099-01-01' })).toEqual([
      'A new local day is ready.',
    ]);
    expect(commandChanges(before, before)).toEqual([]);
  });
});
