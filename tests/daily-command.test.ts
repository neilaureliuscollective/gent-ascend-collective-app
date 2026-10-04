import { describe, expect, it } from 'vitest';
import {
  deriveCommand,
  emptyArrival,
  mutationSchema,
  commandDraft,
  type DailyCommandSignals,
} from '@/domains/daily-command/model';
const input = (patch: Partial<DailyCommandSignals> = {}): DailyCommandSignals => ({
  day: '2026-10-02',
  arrival: emptyArrival,
  signals: [],
  recentTraining: [],
  water: null,
  waterTarget: null,
  priority: null,
  blocker: null,
  goal: null,
  ritual: null,
  occasion: null,
  unavailable: [],
  ...patch,
});
describe('Daily Command rules', () => {
  it('keeps unknown inputs neutral and offers a useful next move', () => {
    const result = deriveCommand(input());
    expect(result.state).toBe('STEADY');
    expect(result.confidence.known).toBe(0);
    expect(result.confidence.missing).toHaveLength(3);
    expect(result.decisions.find((x) => x.id === 'fuel')?.reason).toContain('No deficit');
    expect(result.decisions.length).toBeLessThanOrEqual(5);
  });
  it.each([{ sleepMinutes: 0 }, { energy: 1 }, { soreness: 'high' as const }])(
    'respects reported caution without treating missing as zero: %j',
    (patch) => {
      expect(deriveCommand(input({ arrival: { ...emptyArrival, ...patch } })).state).toBe(
        'RECOVER',
      );
    },
  );
  it('requires complete arrival for ready, and known training context for push', () => {
    const arrival = {
      ...emptyArrival,
      sleepMinutes: 480,
      energy: 5,
      soreness: 'none' as const,
      bandwidth: 'open' as const,
    };
    expect(deriveCommand(input({ arrival })).state).toBe('READY');
    expect(
      deriveCommand(
        input({
          arrival,
          recentTraining: [{ day: '2026-10-01', sets: 8, effort: 6, pain: false }],
        }),
      ).state,
    ).toBe('PUSH');
    expect(
      deriveCommand(
        input({
          arrival,
          recentTraining: [{ day: '2026-10-01', sets: 20, effort: null, pain: false }],
        }),
      ).state,
    ).toBe('READY');
    expect(deriveCommand(input({ arrival, unavailable: ['Training'] })).confidence.level).toBe(
      'partial',
    );
  });
  it('ignores old or future training for caution and does not infer missing effort', () => {
    expect(
      deriveCommand(
        input({
          recentTraining: [
            { day: '2026-09-20', sets: 20, effort: 9, pain: true },
            { day: '2026-10-03', sets: 20, effort: 9, pain: true },
          ],
        }),
      ).state,
    ).toBe('STEADY');
    expect(
      deriveCommand(
        input({ recentTraining: [{ day: '2026-10-01', sets: 8, effort: null, pain: false }] }),
      ).state,
    ).toBe('STEADY');
  });
  it('does not recommend another session when today has recorded training', () => {
    expect(
      deriveCommand(
        input({ recentTraining: [{ day: '2026-10-02', sets: 10, effort: 7, pain: false }] }),
      ).decisions.find((x) => x.id === 'training')?.label,
    ).toBe('RECOVER');
  });
  it('prioritizes occasions and carried priorities with at most five decisions', () => {
    const result = deriveCommand(
      input({
        occasion: { title: 'Wedding', day: '2026-10-04' },
        priority: 'Finish proposal',
        blocker: 'Need scope',
        water: 0,
        waterTarget: 2000,
        ritual: 'Morning care',
      }),
    );
    expect(result.supportingContext.water).toBe(0);
    expect(result.supportingContext.waterTarget).toBe(2000);
    expect(result.decisions.map((x) => x.id)).toEqual([
      'occasion',
      'focus',
      'training',
      'fuel',
      'groom',
    ]);
    expect(result.decisions[1]?.reason).toContain('Need scope');
    expect(result.decisions[3]?.reason).toContain('not evidence of dehydration');
  });
  it('uses prior feedback to explain smaller scope without rewriting a plan', () => {
    const result = deriveCommand(input({ priorFit: 'too-much' }));
    expect(result.interpretation).toContain('scope smaller');
    expect(result.decisions.find((x) => x.id === 'training')?.reason).toContain('Yesterday');
  });
  it('distinguishes evidence provenance in the editable Aethelios draft', () => {
    expect(
      commandDraft(
        deriveCommand(
          input({
            signals: [
              {
                family: 'recovery',
                source: 'user-reported',
                day: '2026-10-02',
                detail: 'Energy 4/5',
              },
            ],
          }),
        ),
      ),
    ).toContain('user-reported (2026-10-02)');
  });
  it('keeps rich-context Aethelios handoffs within the existing composer limit', () => {
    const signals = Array.from({ length: 100 }, () => ({
      family: 'life' as const,
      source: 'user-reported' as const,
      day: '2026-10-02',
      detail: 'Saved evidence '.repeat(30),
    }));
    expect(commandDraft(deriveCommand(input({ signals }))).length).toBeLessThanOrEqual(6000);
  });
  it('rejects unbounded and client-injected recommendation writes', () => {
    const base = {
      kind: 'arrival',
      requestId: crypto.randomUUID(),
      ownerId: crypto.randomUUID(),
      day: '2026-10-02',
      version: 0,
      arrival: emptyArrival,
    };
    expect(mutationSchema.safeParse(base).success).toBe(true);
    expect(mutationSchema.safeParse({ ...base, snapshot: {} }).success).toBe(false);
    expect(
      mutationSchema.safeParse({ ...base, arrival: { ...emptyArrival, sleepMinutes: -1 } }).success,
    ).toBe(false);
  });
});
