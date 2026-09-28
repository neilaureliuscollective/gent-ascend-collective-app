import { describe, expect, it } from 'vitest';
import {
  preparePlan,
  preparationChanges,
  estimatedMinutes,
  nextProgramSlot,
  preparationSignals,
  startProgramSession,
} from '../src/domains/performance/program';
import { programSchema, sessionSchema } from '../src/domains/performance/schema';
import { programFixture } from './component-fixture/performance';
import { nextAdjustment } from '../src/domains/performance/model';
const plan = programFixture.program!.data.sessions[0]!.plan;
describe('program preparation', () => {
  it('reduces volume without changing load, reps or the saved plan', () => {
    const result = preparePlan(plan, 'lighter', 40);
    expect(result.exercises[0]).toEqual({ ...plan.exercises[0], sets: 2 });
    expect(plan.exercises[0]!.sets).toBe(3);
    expect(preparationChanges(plan, result)).toEqual(['Cable row: 3 → 2 sets']);
  });
  it('shortens from the last priority and never increases demand to fill spare time', () => {
    const source = {
      ...plan,
      exercises: [
        ...plan.exercises,
        { ...plan.exercises[0]!, id: crypto.randomUUID(), name: 'Later movement' },
      ],
    };
    const result = preparePlan(source, 'shorter', 10);
    expect(result.exercises.map((e) => e.name)).toEqual(['Cable row']);
    expect(result.exercises[0]!.sets).toBe(1);
    expect(estimatedMinutes(result)).toBeLessThanOrEqual(10);
    expect(preparePlan(source, 'shorter', 120)).toEqual(source);
  });
  it('preserves full prescription and original when creating an offline session', () => {
    const prescription = {
      ruleVersion: 1 as const,
      programVersion: 1,
      slotId: programFixture.program!.nextSlotId,
      mode: 'lighter' as const,
      timeBudget: 40,
      originalPlan: plan,
      plan: preparePlan(plan, 'lighter', 40),
    };
    const session = startProgramSession(prescription);
    expect(sessionSchema.safeParse(session).success).toBe(true);
    expect(session.sets).toHaveLength(2);
    expect(session.prescription.originalPlan.exercises[0]!.sets).toBe(3);
  });
  it('does not infer recovery or apply a legacy progression to an active program', () => {
    expect(preparationSignals(programFixture)).toEqual(['No check-in today. Recovery is unknown.']);
    expect(nextAdjustment(programFixture)).toBe(null);
    expect(nextProgramSlot(programFixture)?.plan.title).toBe('Strength A');
  });
  it('rejects duplicate slots and oversized programs', () => {
    const p = programFixture.program!.data;
    expect(
      programSchema.safeParse({ ...p, sessions: [p.sessions[0], p.sessions[0]] }).success,
    ).toBe(false);
    expect(
      programSchema.safeParse({
        ...p,
        sessions: Array.from({ length: 7 }, () => ({ ...p.sessions[0], id: crypto.randomUUID() })),
      }).success,
    ).toBe(false);
  });
});
