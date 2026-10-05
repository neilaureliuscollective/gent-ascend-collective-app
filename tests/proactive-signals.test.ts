import { describe, expect, it } from 'vitest';
import { selectProactiveSignal } from '@/domains/intelligence/proactive';
import type { CommandData, DailyCommandSnapshot } from '@/domains/daily-command/model';

function command(snapshot: DailyCommandSnapshot): CommandData {
  return { mode: 'personal', snapshot, arrival: { sleepMinutes: null, energy: null, soreness: null, bandwidth: null, minutes: null }, record: null, yesterday: null };
}

function base(): DailyCommandSnapshot {
  return {
    ruleVersion: 1,
    day: '2026-10-05',
    state: 'STEADY',
    reason: 'Keep the day manageable.',
    confidence: { level: 'partial', known: 2, total: 3, missing: ['Sleep'] },
    signals: [],
    decisions: [],
    interpretation: '',
    unavailable: [],
    supportingContext: {
      recentTraining: [],
      water: null,
      waterTarget: null,
      priority: null,
      blocker: null,
      goal: null,
      ritual: null,
      occasion: null,
      priorFit: null,
    },
  };
}

describe('proactive signals', () => {
  it('stays quiet when nothing materially changes the day', () => {
    expect(selectProactiveSignal(command(base()))).toBeNull();
  });

  it('prioritizes an approaching saved occasion', () => {
    const snapshot = base();
    snapshot.supportingContext.occasion = { title: 'Wedding', day: '2026-10-10' };
    snapshot.decisions.push({ id: 'occasion', label: 'PREPARE', detail: 'Wedding', reason: 'Approaching', href: '/app/presence' });
    expect(selectProactiveSignal(command(snapshot))).toMatchObject({ id: 'occasion', title: 'Wedding' });
  });

  it('surfaces recovery only when Daily Command is in RECOVER', () => {
    const snapshot = base();
    snapshot.state = 'RECOVER';
    snapshot.reason = 'Take a more conservative day in light of low energy.';
    snapshot.decisions.push({ id: 'training', label: 'RECOVER', detail: 'Consider rest or a lighter session.', reason: snapshot.reason, href: '/app/performance?space=restore' });
    expect(selectProactiveSignal(command(snapshot))).toMatchObject({ id: 'recovery', href: '/app/performance?space=restore' });
  });

  it('does not elevate ordinary training or hydration into an interruption', () => {
    const snapshot = base();
    snapshot.decisions.push(
      { id: 'training', label: 'TRAIN', detail: 'Review your usual session.', reason: 'Steady day', href: '/app/performance' },
      { id: 'fuel', label: 'HYDRATE', detail: 'Water below target', reason: 'Saved target', href: '/app/performance?space=fuel' },
    );
    expect(selectProactiveSignal(command(snapshot))).toBeNull();
  });
});
