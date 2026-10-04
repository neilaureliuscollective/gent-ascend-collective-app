import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
const dailyRead = vi.hoisted(() => vi.fn());
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
vi.mock('../src/domains/daily/service', () => ({ readDaily: dailyRead }));
import { readContinuity } from '../src/domains/continuity/service';
import { localDay, type DailyData } from '../src/domains/daily/model';
const person = { id: 'owner', timezone: 'America/Chicago' };
const daily = (): DailyData => ({
  ownerId: person.id,
  mode: 'personal',
  today: localDay(new Date(), person.timezone),
  timezone: person.timezone,
  entries: [],
  name: null,
  goal: null,
  conversation: null,
});
function client(results: Record<string, { data: unknown; error: unknown }>) {
  const owners: string[] = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'person_id') owners.push(value);
        return query;
      }),
      in: vi.fn(() => query),
      or: vi.fn(() => query),
      gte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => Promise.resolve(results[table] ?? { data: [], error: null })),
    };
    return query;
  });
  return { from, owners };
}
beforeEach(() => {
  auth.mockReset();
  dailyRead.mockReset();
  dailyRead.mockResolvedValue(daily());
});
describe('request-bound continuity reads', () => {
  it('does not read records without authorized identity', async () => {
    auth.mockResolvedValue(null);
    expect(await readContinuity()).toBeNull();
    expect(dailyRead).not.toHaveBeenCalled();
  });
  it('scopes every domain query to the verified person and marks failed or capped reads unknown', async () => {
    const db = client({
      performance_sessions: { data: Array.from({ length: 100 }, () => ({})), error: null },
      grooming_checkins: { data: null, error: { message: 'offline' } },
    });
    auth.mockResolvedValue({ client: db, person });
    const result = await readContinuity();
    expect(db.owners).toEqual(['owner', 'owner', 'owner']);
    expect(result?.sessionsCompleted).toBeNull();
    expect(result?.practiceDays).toBeNull();
    expect(result?.recordedDays).toBe(0);
  });
  it('rejects snapshots from another person or day before reading any private domain', async () => {
    const db = client({});
    auth.mockResolvedValue({ client: db, person });
    for (const snapshot of [
      { ...daily(), ownerId: 'other' },
      { ...daily(), today: '2020-01-01' },
    ])
      await expect(readContinuity(undefined, snapshot)).rejects.toThrow(/changed/);
    expect(db.from).not.toHaveBeenCalled();
  });
});
