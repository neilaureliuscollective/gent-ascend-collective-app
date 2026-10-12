import { z } from 'zod';
import { allSpecialists } from '@/domains/intelligence/council';
export const missionTask = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    objective: z.string().trim().min(3).max(1200),
    assignee: z.enum(allSpecialists.map((member) => member.id)),
    status: z.enum(['planned', 'needs_review', 'completed']),
    dependsOn: z.array(z.uuid()).max(8),
  })
  .strict();
export type MissionTask = z.infer<typeof missionTask>;
export function taskPlanProblem(tasks: MissionTask[]): string | null {
  const index = new Map(tasks.map((task) => [task.id, task]));
  if (index.size !== tasks.length) return 'Task identifiers must be unique.';
  for (const task of tasks) {
    if (new Set(task.dependsOn).size !== task.dependsOn.length)
      return 'Dependencies must be unique.';
    if (task.dependsOn.some((id) => !index.has(id) || id === task.id))
      return 'Choose other tasks in this mission as dependencies.';
    if (
      task.status === 'completed' &&
      task.dependsOn.some((id) => index.get(id)?.status !== 'completed')
    )
      return 'Complete dependencies before completing a task.';
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function cycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if (index.get(id)!.dependsOn.some(cycle)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return tasks.some((task) => cycle(task.id)) ? 'Task dependencies cannot form a cycle.' : null;
}
export function preserveTaskDecisions(
  proposed: MissionTask[] | undefined,
  existing: MissionTask[] | undefined,
) {
  // Models can propose plans, but completion is a human-confirmed decision.
  const prior = new Map((existing ?? []).map((task) => [task.id, task]));
  if ((existing ?? []).some((task) => !proposed?.some((next) => next.id === task.id))) return false;
  return (proposed ?? []).every((task) => {
    const saved = prior.get(task.id);
    const canonical = (item: MissionTask) =>
      JSON.stringify({
        id: item.id,
        title: item.title,
        objective: item.objective,
        assignee: item.assignee,
        status: item.status,
        dependsOn: [...item.dependsOn].sort(),
      });
    return saved ? canonical(task) === canonical(saved) : task.status === 'planned';
  });
}

// Derived from saved decisions only; readiness never starts an execution.
export function taskReadiness(tasks: MissionTask[], id: string) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return { state: 'unavailable' as const, blockers: [] as string[] };
  if (taskPlanProblem(tasks)) return { state: 'invalid_plan' as const, blockers: [] as string[] };
  const blockers = task.dependsOn.filter(
    (dependency) => tasks.find((item) => item.id === dependency)?.status !== 'completed',
  );
  const state =
    task.status === 'completed'
      ? ('completed' as const)
      : blockers.length
        ? ('blocked' as const)
        : task.status === 'needs_review'
          ? ('needs_review' as const)
          : ('ready' as const);
  return { state, blockers };
}

// Reopening a prerequisite invalidates completed descendants in the same atomic version.
export function reopenTaskPlan(tasks: MissionTask[], id: string): MissionTask[] {
  if (!tasks.some((task) => task.id === id)) return tasks;
  const affected = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (!affected.has(task.id) && task.dependsOn.some((dependency) => affected.has(dependency))) {
        affected.add(task.id);
        changed = true;
      }
    }
  }
  return tasks.map((task) =>
    affected.has(task.id) && task.status === 'completed'
      ? { ...task, status: 'needs_review' }
      : task,
  );
}

export function taskRevisionProblem(previous: MissionTask[], next: MissionTask[]): string | null {
  for (const saved of previous) {
    if (saved.status !== 'completed') continue;
    const replacement = next.find((task) => task.id === saved.id);
    if (
      !replacement ||
      replacement.title !== saved.title ||
      replacement.objective !== saved.objective ||
      replacement.assignee !== saved.assignee ||
      JSON.stringify([...replacement.dependsOn].sort()) !==
        JSON.stringify([...saved.dependsOn].sort())
    )
      return 'Reopen completed milestones before editing or removing them.';
  }
  return taskPlanProblem(next);
}
