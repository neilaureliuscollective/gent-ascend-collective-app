import { z } from 'zod';
import { allSpecialists } from '@/domains/intelligence/council';
import { sourceEvidence, confirmedFigure, type WorkScope } from '@/domains/company-work/schema';
export const founderRequest = z
  .object({
    companyId: z.uuid(),
    jobId: z.uuid(),
    conversationId: z.uuid(),
    objective: z.string().trim().min(3).max(3000),
    specialistId: z.enum(allSpecialists.map((member) => member.id)),
    evidence: z.array(sourceEvidence).max(5).default([]),
    figures: z.array(confirmedFigure).max(12).default([]),
  })
  .strict()
  .refine(
    (input) => new Set(input.figures.map((figure) => figure.id)).size === input.figures.length,
    { message: 'Confirmed figure identifiers must be unique.' },
  );
export function founderScope(
  objective: string,
  specialistId: string,
  evidence: WorkScope['evidence'] = [],
  figures: WorkScope['figures'] = [],
): WorkScope {
  return {
    request: objective,
    audience: 'Founder',
    outcome: 'A useful private deliverable with next actions and evidence gaps.',
    constraints: `Assigned Coworker: ${specialistId}. Use this company only. No external action, spending, publishing or deployment is authorized.`,
    acceptance:
      'Separate supplied evidence from assumptions. Save an inspectable draft and identify what needs founder review. For work requiring a team, propose a taskPlan with specialist assignments and dependencies. Only planned tasks and pending approvalRequests may be proposed.',
    evidence: [...evidence],
    figures: [...figures],
  };
}
