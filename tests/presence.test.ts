import { describe, expect, it } from 'vitest';
import { approachingOccasion } from '@/domains/presence/model';

describe('Presence preparation window', () => {
  it('chooses the nearest saved occasion without mutating history', () => {
    const records = [{ day: '2026-10-12' }, { day: '2026-10-08' }, { day: '2026-10-04' }];
    expect(approachingOccasion(records, '2026-10-05')?.day).toBe('2026-10-08');
    expect(records[0]?.day).toBe('2026-10-12');
  });
  it('includes today and seven days ahead, but never past or distant events', () => {
    expect(approachingOccasion([{ day: '2026-10-05' }], '2026-10-05')).not.toBeNull();
    expect(approachingOccasion([{ day: '2026-10-12' }], '2026-10-05')).not.toBeNull();
    expect(approachingOccasion([{ day: '2026-10-13' }, { day: '2026-10-04' }], '2026-10-05')).toBeNull();
    expect(approachingOccasion([], '2026-10-05')).toBeNull();
  });
});
