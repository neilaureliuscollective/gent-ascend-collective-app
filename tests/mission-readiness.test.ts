import { describe, expect, it } from 'vitest';
import {
  taskReadiness,
  reopenTaskPlan,
  taskPlanProblem,
  taskRevisionProblem,
  type MissionTask,
} from '../src/domains/company-work/tasks';
const task = (
  id: string,
  dependsOn: string[] = [],
  status: MissionTask['status'] = 'planned',
): MissionTask => ({
  id,
  title: id,
  objective: 'Prepare internal work',
  assignee: 'cassius',
  status,
  dependsOn,
});
describe('saved mission readiness and reopening', () => {
  it('distinguishes preparation, review, completed and blocked tasks without execution', () => {
    const tasks = [
      task('a'),
      task('b', ['a']),
      task('c', [], 'needs_review'),
      task('d', [], 'completed'),
    ];
    expect(tasks.map((t) => taskReadiness(tasks, t.id).state)).toEqual([
      'ready',
      'blocked',
      'needs_review',
      'completed',
    ]);
    expect(taskReadiness(tasks, 'b').blockers).toEqual(['a']);
    expect(taskReadiness(tasks, 'missing').state).toBe('unavailable');
  });
  it('fails closed on cycles and missing prerequisites', () => {
    expect(taskReadiness([task('a', ['b']), task('b', ['a'])], 'a').state).toBe('invalid_plan');
    expect(taskReadiness([task('a', ['missing'])], 'a').state).toBe('invalid_plan');
  });
  it('reopens completed transitive dependents atomically and retains independent work', () => {
    const original = [
      task('a', [], 'completed'),
      task('b', ['a'], 'completed'),
      task('c', ['b'], 'completed'),
      task('d', [], 'completed'),
    ];
    const reopened = reopenTaskPlan(original, 'a');
    expect(reopened.map((t) => t.status)).toEqual([
      'needs_review',
      'needs_review',
      'needs_review',
      'completed',
    ]);
    expect(taskPlanProblem(reopened)).toBeNull();
    expect(taskReadiness(reopened, 'c').state).toBe('blocked');
    expect(original.every((t) => t.status === 'completed')).toBe(true);
  });
  it('terminates on corrupt graphs and never loses tasks or saved metadata', () => {
    const tasks = [task('a', ['b']), task('b', ['a'])];
    expect(reopenTaskPlan(tasks, 'a')).toEqual(tasks);
    expect(reopenTaskPlan(tasks, 'missing')).toBe(tasks);
  });
});

describe('milestone correction boundaries', () => {
  it('allows open-task reassignment and correction without losing immutable prior data', () => {
    const original = [task('a')];
    expect(
      taskRevisionProblem(original, [
        { ...original[0]!, title: 'Corrected objective', assignee: 'mara' },
      ]),
    ).toBeNull();
    expect(original[0]!.assignee).toBe('cassius');
  });
  it('requires a separate reopen before changing or removing completed work', () => {
    const original = [task('a', [], 'completed')];
    expect(taskRevisionProblem(original, [])).toMatch(/Reopen/);
    expect(
      taskRevisionProblem(original, [
        { ...original[0]!, objective: 'Changed scope', status: 'needs_review' },
      ]),
    ).toMatch(/Reopen/);
    const reopened = reopenTaskPlan(original, 'a');
    expect(taskRevisionProblem(original, reopened)).toBeNull();
    expect(taskRevisionProblem(reopened, [])).toBeNull();
  });
  it('rejects removal with dangling dependencies and cycles introduced by edits', () => {
    const original = [task('a'), task('b', ['a'])];
    expect(taskRevisionProblem(original, [original[1]!])).toMatch(/dependencies/);
    expect(taskRevisionProblem(original, [task('a', ['b']), original[1]!])).toMatch(/cycle/);
  });
});
