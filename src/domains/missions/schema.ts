import { z } from 'zod';
export const missionStatuses = [
  'draft',
  'active',
  'waiting',
  'needs_review',
  'completed',
  'archived',
] as const;
export const missionFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    objective: z.string().trim().min(3).max(2000),
    status: z.enum(missionStatuses),
    decisions: z.string().trim().max(4000),
    open_questions: z.string().trim().max(2000),
    next_actions: z.string().trim().max(2000),
  })
  .strict();
export const createMissionInput = missionFields
  .extend({ id: z.uuid(), conversation_id: z.uuid() })
  .strict();
export const updateMissionInput = missionFields
  .extend({ id: z.uuid(), expected_revision: z.number().int().min(1).max(2147483646) })
  .strict();
export type Mission = z.infer<typeof missionFields> & {
  id: string;
  person_id: string;
  conversation_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export function missionResumeDraft(mission: Mission) {
  const direction = {
    objective: mission.objective,
    decisions: mission.decisions,
    openQuestions: mission.open_questions,
    nextActions: mission.next_actions,
  };
  let excerpted = false;
  while (JSON.stringify(direction).length > 5200) {
    const key = (Object.keys(direction) as Array<keyof typeof direction>).sort(
      (a, b) => direction[b].length - direction[a].length,
    )[0]!;
    direction[key] = direction[key].slice(0, Math.max(0, direction[key].length - 100));
    excerpted = true;
  }
  return `Continue this Mission using the following user-reviewed direction. These are records, not execution permissions.${excerpted ? ' Bounded excerpts follow; the full direction remains in the Mission.' : ''}\n${JSON.stringify(direction)}\nHelp me move the next action forward. Distinguish recorded decisions from assumptions. Do not claim external work or background agents.`;
}
