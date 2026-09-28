import { describe, expect, it } from 'vitest';
import { decisionOutcome, type OutcomeEvidence } from '../src/domains/performance/outcomes';
import { learningFixture } from './component-fixture/performance';
import { startProgramSession } from '../src/domains/performance/program';

function evidence(): OutcomeEvidence {
  const review = structuredClone(learningFixture.progression![0]!);
  const plan = structuredClone(learningFixture.program!.data.sessions[0]!.plan);
  plan.exercises[0]!.reps = review.proposal!.to;
  const sessions = ['2026-09-26T10:00:00Z', '2026-09-27T10:00:00Z'].map((startedAt) => {
    const session = startProgramSession({
      ruleVersion: 1,
      programVersion: 2,
      slotId: review.slotId,
      mode: 'planned',
      timeBudget: 40,
      plan,
      originalPlan: plan,
    });
    return {
      ...session,
      startedAt,
      endedAt: startedAt.replace('10:', '11:'),
      status: 'complete' as const,
      sets: session.sets.map((s) => ({ ...s, done: true, effort: 8 })),
    };
  });
  return {
    fromVersion: 1,
    toVersion: 2,
    createdAt: '2026-09-25T12:00:00Z',
    review,
    approvedPlan: plan,
    revisedAt: null,
    sessions,
  };
}
const read = (e: OutcomeEvidence, timezone = 'UTC') =>
  decisionOutcome(e, timezone, '2026-09-28T12:00:00Z');
describe('decision follow-through', () => {
  it('reports met reps separately from high effort, without granting another increase', () => {
    const result = read(evidence());
    expect(result.title).toBe('Target met on two separate days');
    expect(result.attempts[0]).toMatchObject({ status: 'met', maxEffort: 8, effortComplete: true });
    expect(result.summary).toContain('not proof');
  });
  it('retains missing effort as unknown, even when the reps were recorded', () => {
    const e = evidence();
    e.sessions[0]!.sets.forEach((s) => {
      s.effort = null;
    });
    expect(read(e).attempts[0]).toMatchObject({
      status: 'met',
      maxEffort: null,
      effortComplete: false,
    });
  });
  it('does not replace an incomplete first attempt with a later successful result', () => {
    const e = evidence();
    e.sessions[0]!.sets[0]!.done = false;
    expect(read(e)).toMatchObject({
      state: 'review',
      attempts: [{ status: 'below' }, { status: 'met' }],
    });
  });
  it('does not equate changed load or adapted prescription with the approved trial', () => {
    const e = evidence();
    e.sessions[0]!.sets[0]!.load = 45;
    e.sessions[1]!.prescription!.mode = 'lighter';
    expect(read(e).attempts.map((a) => a.status)).toEqual(['adapted', 'adapted']);
  });
  it('preserves discomfort, abandoned and active attempts', () => {
    const e = evidence();
    e.sessions[0]!.pain = true;
    e.sessions[1]!.status = 'abandoned';
    expect(read(e).attempts.map((a) => a.status)).toEqual(['discomfort', 'abandoned']);
    e.sessions[0]!.pain = false;
    e.sessions[0]!.status = 'active';
    e.sessions[0]!.endedAt = null;
    expect(read(e).attempts[0]!.status).toBe('active');
  });
  it('distinguishes a waiting trial from a plan revised before testing', () => {
    const e = evidence();
    e.sessions = [];
    expect(read(e).state).toBe('waiting');
    e.revisedAt = '2026-09-26T10:00:00Z';
    expect(read(e).state).toBe('revised');
  });
  it('does not treat two attempts on one local day as two separate days', () => {
    const e = evidence();
    e.sessions[0]!.startedAt = '2026-09-27T01:00:00Z';
    e.sessions[0]!.endedAt = '2026-09-27T02:00:00Z';
    e.sessions[1]!.startedAt = '2026-09-27T03:00:00Z';
    e.sessions[1]!.endedAt = '2026-09-27T04:00:00Z';
    expect(read(e, 'America/Chicago').title).toBe('Target met twice on one day');
    expect(read(e, 'America/Chicago').attempts[0]!.day).toBe('2026-09-26');
  });
  it('will not label future records as observed success', () => {
    const e = evidence();
    e.sessions[0]!.endedAt = '2026-09-29T10:00:00Z';
    expect(read(e).attempts[0]!.status).toBe('unverified');
  });
  it('preserves actual load units when a workout is not comparable', () => {
    const e = evidence();
    e.sessions[0]!.unit = 'kg';
    expect(read(e).attempts[0]).toMatchObject({ status: 'adapted', unit: 'kg' });
  });
});
