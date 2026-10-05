import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const authorize = vi.hoisted(() => vi.fn());
vi.mock('@/domains/access/authorize', () => ({ authorizedPerson: authorize }));
import { readPresence } from '@/domains/presence/service';

beforeEach(() => { vi.useRealTimers(); authorize.mockReset(); });
it('does not query private records without authorization', async () => {
  authorize.mockResolvedValue(null);
  expect((await readPresence()).mode).toBe('signed-out');
  expect(authorize).toHaveBeenCalledWith('profile.read');
});
it('keeps owner filters, local dates, and partial availability explicit', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T01:00:00Z'));
  const filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const result = table === 'grooming_profiles' ? { data: null, error: 'unavailable' }
      : table === 'grooming_events' ? { data: [{ title: 'Meeting', event_date: '2026-10-08', note: 'Formal' }], error: null }
      : { data: [{ name: 'Vitalis', note: 'Low' }], error: null };
    const query = {
      select: () => query,
      eq: (field: string, value: string) => { filters.push([table, field, value]); return query; },
      gte: (field: string, value: string) => { filters.push([table, field, value]); return query; },
      order: () => query,
      limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
    };
    return query;
  });
  authorize.mockResolvedValue({ person: { id: 'session-owner', timezone: 'America/Chicago' }, client: { from } });
  const data = await readPresence();
  expect(data.today).toBe('2026-10-05');
  expect(data.unavailable).toEqual(['Appearance direction']);
  expect(data.occasions).toEqual([{ title: 'Meeting', day: '2026-10-08', note: 'Formal' }]);
  expect(data.replenishment[0]?.name).toBe('Vitalis');
  expect(filters.filter(x => x[1] === 'person_id')).toHaveLength(3);
  expect(filters.filter(x => x[1] === 'person_id').every(x => x[2] === 'session-owner')).toBe(true);
  expect(filters).toContainEqual(['grooming_events', 'event_date', '2026-10-05']);
  expect(filters).toContainEqual(['grooming_products', 'relation', 'running_low']);
  expect(from.mock.calls.map(x => x[0])).not.toContain('grooming_checkins');
  vi.useRealTimers();
});
