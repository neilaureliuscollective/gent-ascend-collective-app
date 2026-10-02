import { describe, expect, it } from 'vitest';
import { profileSchema } from '../src/domains/person/validation';
import {
  goalMutationSchema,
  goalTransitionSchema,
  formatCalendarDate,
} from '../src/domains/goals/validation';
const profile = {
  display_name: ' Founder ',
  timezone: 'America/Chicago',
  unit_system: 'metric',
  priority: ' Intention ',
  version: '1',
};
const goal = {
  id: '10000000-0000-4000-8000-000000000001',
  version: '0',
  title: ' Build consistency ',
  domain: 'life',
  next_step: ' Plan tomorrow ',
  reason: '',
  target_date: '',
};
describe('profile and goal input boundaries', () => {
  it('normalizes personal fields without accepting ownership or entitlement input', () => {
    expect(profileSchema.parse({ ...profile, person_id: 'intruder', tier: 'health' })).toEqual({
      ...profile,
      display_name: 'Founder',
      priority: 'Intention',
      version: 1,
    });
    expect(
      goalMutationSchema.parse({ ...goal, person_id: 'intruder', status: 'completed' }),
    ).toEqual({ ...goal, title: 'Build consistency', next_step: 'Plan tomorrow', version: 0 });
  });
  it('rejects invalid profile values and stale-version placeholders', () => {
    for (const invalid of [
      { display_name: ' ' },
      { timezone: 'Fake/Zone' },
      { unit_system: 'other' },
      { priority: 'x'.repeat(281) },
      { version: 0 },
    ]) {
      expect(profileSchema.safeParse({ ...profile, ...invalid }).success).toBe(false);
    }
  });
  it('validates calendar dates without inventing a timestamp or accepting rollover', () => {
    for (const date of ['', '2028-02-29', '2026-12-31'])
      expect(goalMutationSchema.safeParse({ ...goal, target_date: date }).success).toBe(true);
    for (const date of ['2026-02-29', '2026-04-31', '2026-1-1', '2101-01-01'])
      expect(goalMutationSchema.safeParse({ ...goal, target_date: date }).success).toBe(false);
    expect(formatCalendarDate('2026-01-01')).toBe('Jan 1, 2026');
  });
  it('requires a concrete goal and only permits explicit closing transitions', () => {
    for (const invalid of [
      { title: ' ' },
      { next_step: '' },
      { domain: 'clinical' },
      { version: -1 },
    ])
      expect(goalMutationSchema.safeParse({ ...goal, ...invalid }).success).toBe(false);
    expect(
      goalTransitionSchema.safeParse({ id: goal.id, version: 1, status: 'completed' }).success,
    ).toBe(true);
    expect(
      goalTransitionSchema.safeParse({ id: goal.id, version: 1, status: 'active' }).success,
    ).toBe(false);
  });
});
