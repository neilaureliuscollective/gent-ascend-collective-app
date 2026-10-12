import 'server-only';
import { z } from 'zod';
import { founderSession } from './service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { readWork, saveWork, generateWork } from '@/domains/company-work/service';
import { emptyWork } from '@/domains/company-work/schema';
import { missionTask, taskReadiness, taskRevisionProblem } from '@/domains/company-work/tasks';
const scope = {
  companyId: z.uuid(),
  jobId: z.uuid(),
  expected: z.number().int().min(0).max(2147483646),
};
export const taskSave = z
  .object({ ...scope, versionId: z.uuid(), taskPlan: z.array(missionTask).max(24) })
  .strict();
export const taskGenerate = z.object({ ...scope, requestId: z.uuid(), taskId: z.uuid() }).strict();
export function workSnapshot(work: Awaited<ReturnType<typeof readWork>>, expected: number) {
  if (expected === 0)
    return {
      ...emptyWork(work.job.scope.request),
      summary:
        'Manually prepared mission plan. No model deliverable or external action has been executed.',
    };
  const previous = work.versions.find((v) => v.revision === expected);
  if (!previous) throw new IntelligenceError('Task snapshot unavailable. Reload the mission.', 409);
  return previous.content;
}
export async function saveTaskPlan(input: z.infer<typeof taskSave>) {
  await founderSession();
  const work = await readWork(input.companyId, input.jobId);
  const snapshot = workSnapshot(work, input.expected);
  const problem = taskRevisionProblem(snapshot.taskPlan ?? [], input.taskPlan);
  if (problem) throw new IntelligenceError(problem, 409);
  const content = { ...snapshot, taskPlan: input.taskPlan };
  // The shared save schema verifies the graph; SQL supplies atomic CAS and full-payload replay.
  const parsed = (await import('@/domains/company-work/schema')).workContent.safeParse(content);
  if (!parsed.success)
    throw new IntelligenceError(parsed.error.issues[0]?.message ?? 'Check task dependencies.');
  return saveWork(input.companyId, input.jobId, input.versionId, input.expected, parsed.data);
}
export async function prepareTask(input: z.infer<typeof taskGenerate>, signal: AbortSignal) {
  await founderSession();
  const work = await readWork(input.companyId, input.jobId);
  const content = workSnapshot(work, input.expected);
  const task = content.taskPlan?.find((task) => task.id === input.taskId);
  if (!task) throw new IntelligenceError('Task not found in this mission snapshot.', 404);
  const readiness = taskReadiness(content.taskPlan ?? [], task.id);
  if (readiness.state === 'completed')
    throw new IntelligenceError('Reopen the completed task before preparing new work.', 409);
  if (readiness.state === 'invalid_plan')
    throw new IntelligenceError('Repair the saved task dependencies before preparing work.', 409);
  if (readiness.state === 'blocked')
    throw new IntelligenceError(
      'Review and complete the dependencies before preparing this task.',
      409,
    );
  return generateWork(
    {
      companyId: input.companyId,
      jobId: input.jobId,
      requestId: input.requestId,
      expected: input.expected,
      specialistId: task.assignee,
      instruction: `Prepare the internal deliverable for task ${task.id}: ${task.title}. ${task.objective}\nPreserve all existing taskPlan records exactly. Do not mark tasks completed, execute external actions or change approved decisions. Put the useful task result into the brief and slides while preserving unaffected work.`,
    },
    signal,
  );
}
