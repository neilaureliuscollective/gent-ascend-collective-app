import { describe, it, expect } from 'vitest';
import { emptyWork, workContent, generatedWorkContent } from '../src/domains/company-work/schema';
import { preserveTaskDecisions } from '../src/domains/company-work/tasks';
import { preserveApprovalDecisions } from '../src/domains/company-work/approvals';
describe('work version compatibility and rollback reader', () => {
  it('reads historical payloads and additive controls without discarding them', () => {
    const old = emptyWork('Historical draft');
    expect(workContent.parse(old)).toEqual(old);
    const task = {
      id: 'd7000000-0000-4000-8000-000000000401',
      title: 'Verify source',
      objective: 'Review this supplied source',
      assignee: 'mara' as const,
      status: 'completed' as const,
      dependsOn: [],
    };
    const approval = {
      id: 'd7000000-0000-4000-8000-000000000402',
      kind: 'publishing' as const,
      title: 'Publish reviewed source',
      proposal: 'Publish only this reviewed source.',
      status: 'approved' as const,
      figureIds: [],
    };
    const expanded = { ...old, taskPlan: [task], approvalRequests: [approval] };
    expect(workContent.parse(JSON.parse(JSON.stringify(expanded)))).toEqual(expanded);
    expect(
      preserveTaskDecisions(
        [Object.fromEntries(Object.entries(task).reverse()) as typeof task],
        [task],
      ),
    ).toBe(true);
    expect(
      preserveApprovalDecisions(
        [Object.fromEntries(Object.entries(approval).reverse()) as typeof approval],
        [approval],
      ),
    ).toBe(true);
  });
  it('requires both control arrays in strict provider output and denies invented human completion', () => {
    const draft = emptyWork('Provider output');
    expect(generatedWorkContent.safeParse(draft).success).toBe(false);
    expect(
      generatedWorkContent.safeParse({ ...draft, taskPlan: [], approvalRequests: [] }).success,
    ).toBe(true);
    expect(
      preserveTaskDecisions(
        [
          {
            id: 'd7000000-0000-4000-8000-000000000401',
            title: 'Verify source',
            objective: 'Review this supplied source',
            assignee: 'mara',
            status: 'completed',
            dependsOn: [],
          },
        ],
        [],
      ),
    ).toBe(false);
    expect(
      preserveApprovalDecisions(
        [
          {
            id: 'd7000000-0000-4000-8000-000000000402',
            kind: 'deployment',
            title: 'Deploy proposed release',
            proposal: 'Deploy only the proposed release.',
            status: 'approved',
            figureIds: [],
          },
        ],
        [],
      ),
    ).toBe(false);
  });
});
