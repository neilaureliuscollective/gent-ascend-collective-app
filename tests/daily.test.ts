import { daySchema } from '../src/domains/daily/schema';
import { describe, it, expect } from 'vitest';
import { localDay, daysEnding, emptyDay, sampleData, nextLoopMove, type DailyData } from '../src/domains/daily/model';
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
  it('guides a real first day from confirmed state through tomorrow without a fabricated score', () => {
    const data: DailyData = { mode: 'personal', name: 'Founder', today: '2026-09-25', timezone: 'America/Chicago', entries: [], goal: null, conversation: null };
    expect(nextLoopMove(data)?.target).toBe('profile');
    data.profileDirection = 'Build a dependable daily practice';
    expect(nextLoopMove(data)?.target).toBe('goal');
    data.goal = { title: 'Build my company', next_step: 'Speak to one partner' };
    expect(nextLoopMove(data)?.target).toBe('intention');
    const today = emptyDay(data.today, data.timezone);
    data.entries = [today];
    today.intention = 'Talk to a partner';
    expect(nextLoopMove(data)?.target).toBe('action');
    today.actions = [{ id: '62000000-0000-4000-8000-000000000002', title: 'Call a partner', done: false }];
    expect(nextLoopMove(data)?.target).toBe('complete');
    today.actions[0]!.done = true;
    expect(nextLoopMove(data)?.target).toBe('review');
    today.review = { progress: 'Made the call', blocker: '', tomorrow: 'Follow up', version: 1, source_kind: 'user', source_day_version: 1, confirmed_at: '2026-09-25T21:00:00Z' };
    expect(nextLoopMove(data)?.target).toBe('tomorrow');
    expect(nextLoopMove({ ...data, mode: 'sample' })).toBeNull();
  });
});
