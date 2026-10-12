import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyWork,
  workContent,
  generatedWorkContent,
  validateFigures,
  hasGeneratedFinancialLiteral,
} from '../src/domains/company-work/schema';
import {
  taskPlanProblem,
  preserveTaskDecisions,
  type MissionTask,
} from '../src/domains/company-work/tasks';
import {
  preserveApprovalDecisions,
  type WorkApproval,
} from '../src/domains/company-work/approvals';
import { syntheticWork } from './component-fixture/company-work-data';
const state = vi.hoisted(() => ({ founder: true, work: null as unknown }));
const read = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
const generate = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/founder-office/service', () => ({
  founderSession: async () => {
    if (!state.founder) throw new Error('Founder access required');
    return {};
  },
}));
vi.mock('../src/domains/company-work/service', () => ({
  readWork: read,
  saveWork: save,
  generateWork: generate,
}));
import { saveTaskPlan, prepareTask } from '../src/domains/founder-office/tasks';
import {
  createApproval,
  decideApproval,
  revokeApproval,
} from '../src/domains/founder-office/approvals';
const first = 'd7000000-0000-4000-8000-000000000101',
  second = 'd7000000-0000-4000-8000-000000000102';
const task = (id = first, overrides: Partial<MissionTask> = {}): MissionTask => ({
  id,
  title: 'Inspect evidence',
  objective: 'Review supplied company documents',
  assignee: 'mara',
  status: 'planned',
  dependsOn: [],
  ...overrides,
});
const approval = (overrides: Partial<WorkApproval> = {}): WorkApproval => ({
  id: first,
  title: 'Publish reviewed proposal',
  proposal: 'Publish this exact draft after reviewing its sources.',
  kind: 'publishing',
  status: 'pending',
  figureIds: [],
  ...overrides,
});
const scope = { companyId: syntheticWork.job.company_id, jobId: syntheticWork.job.id, expected: 1 };
beforeEach(() => {
  state.founder = true;
  state.work = structuredClone(syntheticWork);
  read.mockReset();
  save.mockReset();
  generate.mockReset();
  read.mockImplementation(async () => state.work);
  save.mockResolvedValue(state.work);
  generate.mockResolvedValue(state.work);
});
describe('mission task graph and human decisions', () => {
  it('keeps old saved versions readable while requiring explicit arrays in provider output', () => {
    expect(workContent.safeParse(emptyWork('Legacy')).success).toBe(true);
    expect(generatedWorkContent.safeParse(emptyWork('Legacy')).success).toBe(false);
    expect(
      generatedWorkContent.safeParse({
        ...emptyWork('Generated'),
        taskPlan: [],
        approvalRequests: [],
      }).success,
    ).toBe(true);
  });
  it('rejects duplicate, self, missing and cyclic dependencies and premature completion', () => {
    for (const tasks of [
      [task(), task()],
      [task(first, { dependsOn: [first] })],
      [task(first, { dependsOn: [second] })],
      [task(first, { dependsOn: [second] }), task(second, { dependsOn: [first] })],
      [task(), task(second, { dependsOn: [first], status: 'completed' })],
    ])
      expect(taskPlanProblem(tasks)).not.toBeNull();
    expect(
      taskPlanProblem([
        task(first, { status: 'completed' }),
        task(second, { dependsOn: [first], status: 'completed' }),
      ]),
    ).toBeNull();
  });
  it('models cannot complete, discard or rewrite saved task and approval decisions', () => {
    const done = task(first, { status: 'completed' }),
      approved = approval({ status: 'approved' });
    expect(preserveTaskDecisions([done], [])).toBe(false);
    expect(preserveTaskDecisions([], [done])).toBe(false);
    expect(preserveTaskDecisions([{ ...done, objective: 'Different work' }], [done])).toBe(false);
    expect(preserveTaskDecisions([done, task(second)], [done])).toBe(true);
    expect(
      preserveTaskDecisions(
        [Object.fromEntries(Object.entries(done).reverse()) as MissionTask],
        [done],
      ),
    ).toBe(true);
    expect(preserveApprovalDecisions([approved], [])).toBe(false);
    expect(preserveApprovalDecisions([], [approved])).toBe(false);
    expect(
      preserveApprovalDecisions([{ ...approved, proposal: 'Different publication' }], [approved]),
    ).toBe(false);
    expect(preserveApprovalDecisions([approved, approval({ id: second })], [approved])).toBe(true);
    expect(
      preserveApprovalDecisions(
        [Object.fromEntries(Object.entries(approved).reverse()) as WorkApproval],
        [approved],
      ),
    ).toBe(true);
  });
  it('uses the existing immutable deliverable write with stable task receipts', async () => {
    const versionId = crypto.randomUUID(),
      input = { ...scope, versionId, taskPlan: [task()] };
    await saveTaskPlan(input);
    await saveTaskPlan(input);
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
    expect(save).toHaveBeenCalledWith(
      scope.companyId,
      scope.jobId,
      versionId,
      1,
      expect.objectContaining({ taskPlan: [task()] }),
    );
    expect(save.mock.calls[0]![4].slides).toEqual(syntheticWork.versions[0]!.content.slides);
  });
  it('denies changing or deleting completed milestones before the immutable save', async () => {
    const work = structuredClone(syntheticWork);
    work.versions[0]!.content.taskPlan = [task(first, { status: 'completed' })];
    state.work = work;
    for (const taskPlan of [
      [],
      [task(first, { status: 'needs_review', objective: 'Changed objective' })],
    ]) {
      await expect(
        saveTaskPlan({ ...scope, versionId: crypto.randomUUID(), taskPlan }),
      ).rejects.toThrow(/Reopen/);
    }
    expect(save).not.toHaveBeenCalled();
  });
  it('blocks dependency execution and routes a ready task through the shared scoped generator', async () => {
    const work = structuredClone(syntheticWork);
    work.versions[0]!.content.taskPlan = [task(), task(second, { dependsOn: [first] })];
    state.work = work;
    const input = { ...scope, requestId: crypto.randomUUID(), taskId: second };
    await expect(prepareTask(input, new AbortController().signal)).rejects.toThrow(/dependencies/);
    expect(generate).not.toHaveBeenCalled();
    work.versions[0]!.content.taskPlan![0]!.status = 'completed';
    await prepareTask(input, new AbortController().signal);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...scope,
        requestId: input.requestId,
        specialistId: 'mara',
        instruction: expect.stringContaining(second),
      }),
      expect.any(AbortSignal),
    );
  });
  it('requires explicit reopening before a completed task can invoke a provider', async () => {
    const work = structuredClone(syntheticWork);
    work.versions[0]!.content.taskPlan = [task(first, { status: 'completed' })];
    state.work = work;
    await expect(
      prepareTask(
        { ...scope, requestId: crypto.randomUUID(), taskId: first },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/Reopen/);
    expect(generate).not.toHaveBeenCalled();
  });
  it('rejects graph corruption and unavailable old snapshots before saving or generating', async () => {
    await expect(
      saveTaskPlan({
        ...scope,
        versionId: crypto.randomUUID(),
        taskPlan: [task(first, { dependsOn: [first] })],
      }),
    ).rejects.toThrow(/dependencies/);
    await expect(
      prepareTask(
        { ...scope, expected: 1000, requestId: crypto.randomUUID(), taskId: first },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/snapshot unavailable/);
    expect(save).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it('requires founder authority before any control reads or writes', async () => {
    state.founder = false;
    await expect(
      saveTaskPlan({ ...scope, versionId: crypto.randomUUID(), taskPlan: [] }),
    ).rejects.toThrow(/Founder/);
    await expect(
      createApproval({ ...scope, versionId: crypto.randomUUID(), proposal: approval() }),
    ).rejects.toThrow(/Founder/);
    await expect(
      decideApproval({
        ...scope,
        versionId: crypto.randomUUID(),
        proposalId: first,
        approve: true,
      }),
    ).rejects.toThrow(/Founder/);
    expect(read).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
describe('approval snapshots without external execution', () => {
  it('saves pending requests and binds stable decisions to the exact saved proposal', async () => {
    const pending = approval(),
      { status: _, ...proposal } = pending;
    void _;
    await createApproval({ ...scope, versionId: first, proposal });
    expect(save.mock.calls[0]![4].approvalRequests).toEqual([pending]);
    const work = structuredClone(syntheticWork);
    work.versions[0]!.content.approvalRequests = [pending];
    state.work = work;
    save.mockClear();
    const decision = { ...scope, versionId: second, proposalId: first, approve: true };
    await decideApproval(decision);
    await decideApproval(decision);
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
    expect(save.mock.calls[0]![4].approvalRequests[0]).toEqual({ ...pending, status: 'approved' });
    expect(generate).not.toHaveBeenCalled();
  });
  it('withdraws only approved proposals with a stable saved receipt and no external executor', async () => {
    const work = structuredClone(syntheticWork);
    const approved = approval({ status: 'approved' });
    work.versions[0]!.content.approvalRequests = [approved];
    state.work = work;
    const input = { ...scope, versionId: second, proposalId: first, action: 'revoke' as const };
    await revokeApproval(input);
    await revokeApproval(input);
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
    expect(save.mock.calls[0]![4].approvalRequests).toEqual([{ ...approved, status: 'rejected' }]);
    expect(generate).not.toHaveBeenCalled();
    work.versions[0]!.content.approvalRequests = [approval()];
    await expect(revokeApproval(input)).rejects.toThrow(/Only an approved/);
    state.founder = false;
    await expect(revokeApproval(input)).rejects.toThrow(/Founder/);
  });
  it('rejects already decided or missing proposals and unknown financial references', async () => {
    const work = structuredClone(syntheticWork);
    work.versions[0]!.content.approvalRequests = [approval({ status: 'rejected' })];
    state.work = work;
    await expect(
      decideApproval({ ...scope, versionId: second, proposalId: first, approve: true }),
    ).rejects.toThrow(/already has a decision/);
    await expect(
      decideApproval({ ...scope, versionId: second, proposalId: second, approve: true }),
    ).rejects.toThrow(/not found/);
    const content = {
      ...emptyWork('Review'),
      approvalRequests: [approval({ figureIds: [first] })],
    };
    expect(validateFigures(content, syntheticWork.job.scope)).toBe(false);
    expect(
      hasGeneratedFinancialLiteral({
        ...content,
        approvalRequests: [approval({ proposal: 'Spend $900 today' })],
      }),
    ).toBe(true);
    expect(
      workContent.safeParse({ ...content, approvalRequests: [approval(), approval()] }).success,
    ).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
