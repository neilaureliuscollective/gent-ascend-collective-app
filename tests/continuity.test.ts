import { describe, it, expect } from 'vitest';
import { projectContinuity } from '../src/domains/continuity/model';
import { emptyDay, type DailyData } from '../src/domains/daily/model';
import { sourceFooter, researchTools } from '../src/domains/intelligence/research';
const daily: DailyData = {
  mode: 'personal',
  ownerId: 'owner',
  today: '2026-10-04',
  timezone: 'America/Chicago',
  name: null,
  goal: null,
  conversation: null,
  entries: [
    {
      ...emptyDay('2026-10-04', 'America/Chicago'),
      version: 1,
      actions: [{ id: crypto.randomUUID(), title: 'Prepare', done: false }],
    },
  ],
};
describe('connected member week', () => {
  it('uses member calendar dates, completion timestamps and actual saved actions', () => {
    const result = projectContinuity(daily, {
      rituals: [],
      checkins: [],
      sessions: [
        {
          id: '1',
          title: 'Late session',
          status: 'complete',
          started_at: '2026-10-05T01:00:00Z',
          ended_at: '2026-10-05T03:00:00Z',
        },
        {
          id: '2',
          title: 'Tomorrow',
          status: 'complete',
          started_at: '2026-10-05T06:00:00Z',
          ended_at: '2026-10-05T07:00:00Z',
        },
        {
          id: '3',
          title: 'Resume me',
          status: 'active',
          started_at: '2026-10-04T12:00:00Z',
          ended_at: null,
        },
      ],
    });
    expect(result.sessionsCompleted).toBe(1);
    expect(result.week.at(-1)?.sessions).toBe(1);
    expect(result.actionsCompleted).toBe(0);
    expect(result.recordedDays).toBe(1);
    expect(result.activeSession?.title).toBe('Resume me');
    expect(result.nextAction).toBe('Prepare');
  });
  it('keeps missing source data unknown and missing daily records distinct from zero', () => {
    const result = projectContinuity(daily, { sessions: null, rituals: null, checkins: null });
    expect(result.sessionsCompleted).toBeNull();
    expect(result.practiceDays).toBeNull();
    expect(result.week[0]).toMatchObject({ recorded: false, sessions: null, rituals: null });
    expect(result.unavailable).toEqual(['Training', 'Rituals', 'Grooming practice']);
  });
  it('uses latest ritual/day observation, counts practice days once and excludes future/invalid times', () => {
    const result = projectContinuity(daily, {
      sessions: [],
      rituals: [{ id: 'r', title: 'Morning', kind: 'morning' }],
      checkins: [
        { ritual_id: 'r', done: true, occurred_at: '2026-10-04T12:00:00Z' },
        { ritual_id: 'r', done: false, occurred_at: '2026-10-04T14:00:00Z' },
        { ritual_id: 'r2', done: true, occurred_at: '2026-10-04T15:00:00Z' },
        { ritual_id: 'r2', done: true, occurred_at: '2026-10-04T16:00:00Z' },
        { ritual_id: 'r', done: true, occurred_at: '2026-10-05T12:00:00Z' },
        { ritual_id: 'r', done: true, occurred_at: 'invalid' },
      ],
    });
    expect(result.practiceDays).toBe(1);
    expect(result.week.at(-1)?.rituals).toBe(1);
    expect(result.rituals[0]?.practicedToday).toBe(false);
  });
});
describe('shared read-only web research', () => {
  it('exposes exactly the provider search tool without adding write tools', () => {
    expect(Object.keys(researchTools)).toEqual(['web_search']);
  });
  it('renders only valid provider sources, deduplicates and escapes Markdown injection', () => {
    const footer = sourceFooter([
      { url: 'javascript:alert(1)' },
      { url: 'https://name:secret@example.com' },
      { url: 'https://example.com/a(b)', title: '[fake](javascript:evil)\nInjected' },
      { url: 'https://example.com/a(b)' },
      { url: 'https://docs.example.com' },
    ]);
    expect(footer).not.toContain('javascript:alert');
    expect(footer).not.toContain('name:secret');
    expect(footer.match(/https:\/\/example.com/g)).toHaveLength(1);
    expect(footer).toContain('a%28b%29');
    expect(sourceFooter([])).toBe('');
    expect(
      sourceFooter(
        Array.from({ length: 30 }, (_, i) => ({ url: `https://example.com/${i}` })),
      ).split('\n- '),
    ).toHaveLength(13);
  });
});
