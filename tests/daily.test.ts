import { daySchema } from '../src/domains/daily/schema';
import { describe, it, expect } from 'vitest';
import { localDay, daysEnding, emptyDay, sampleData } from '../src/domains/daily/model';
import { calculateCapabilities } from '../src/domains/access/policy';
describe('daily observation boundaries', () => {
  it('uses the person timezone across midnight and preserves calendar dates across DST', () => {
    expect(localDay(new Date('2026-09-22T01:00:00Z'), 'America/Chicago')).toBe('2026-09-21');
    expect(localDay(new Date('2026-09-22T01:00:00Z'), 'Asia/Tokyo')).toBe('2026-09-22');
    expect(daysEnding('2026-03-09', 3)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
  });
  it('distinguishes missing sleep from zero and rejects fabricated scores or oversized action lists', () => {
    const day = emptyDay('2026-09-21', 'UTC');
    expect(daySchema.parse(day).sleep_minutes).toBeNull();
    expect(daySchema.parse({ ...day, sleep_minutes: 0 }).sleep_minutes).toBe(0);
    expect(daySchema.safeParse({ ...day, energy: 0 }).success).toBe(false);
    const action = { id: '62000000-0000-4000-8000-000000000001', title: 'A step', done: false };
    expect(daySchema.safeParse({ ...day, actions: [action, action] }).success).toBe(false);
    expect(daySchema.safeParse({ ...day, actions: Array(6).fill(action) }).success).toBe(false);
  });
  it('keeps sample records distinct, includes missing days, and grants daily access independently of paid billing', () => {
    const sample = sampleData('2026-09-21');
    expect(sample.mode).toBe('sample');
    expect(sample.entries).toHaveLength(6);
    expect(sample.entries.every((entry) => daySchema.safeParse(entry).success)).toBe(true);
    const access = calculateCapabilities({ tier: 'free', billing: 'none', beta: false });
    expect(access.has('daily.read')).toBe(true);
    expect(access.has('daily.write')).toBe(true);
    expect(access.has('clinical.care')).toBe(false);
  });
});
