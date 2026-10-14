import { describe, expect, it } from 'vitest';
import { sampleEstimatorConfig } from '@/domains/architect-tools/engine';
import {
  acceptToolSaveReceipt,
  beginOrRetryToolSave,
  findCommittedToolSave,
  isToolDraftDirty,
  replayPayloadChanged,
  toolLibraryRefreshFollowUp,
} from '@/domains/architect-tools/save-lifecycle';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';
const tool = '00000000-0000-4000-8000-000000000030';
const request = '00000000-0000-4000-8000-000000000031';

describe('estimator save snapshot retries', () => {
  it('retries the immutable first snapshot instead of a new tool id or later draft', () => {
    const first = beginOrRetryToolSave({
      pending: null,
      ownerId: owner,
      projectId: project,
      toolId: null,
      expected: 0,
      name: 'Plywood estimator',
      configuration: sampleEstimatorConfig(),
      note: 'User saved estimator revision',
      nextIds: { toolId: tool, requestId: request },
    });
    const laterDraft = { ...sampleEstimatorConfig(), waste_percent: '20' };
    const retry = beginOrRetryToolSave({
      pending: first.snapshot,
      ownerId: owner,
      projectId: project,
      toolId: '00000000-0000-4000-8000-000000000099',
      expected: 0,
      name: 'Changed after submit',
      configuration: laterDraft,
      note: 'Different note',
      nextIds: {
        toolId: '00000000-0000-4000-8000-000000000098',
        requestId: '00000000-0000-4000-8000-000000000097',
      },
    });
    expect(retry.reused).toBe(true);
    expect(retry.snapshot.toolId).toBe(tool);
    expect(retry.snapshot.requestId).toBe(request);
    expect(retry.snapshot.configuration.waste_percent).toBe('10');
    expect(replayPayloadChanged(first.snapshot, { name: 'Changed after submit', configuration: laterDraft, note: 'Different note' })).toBe(
      true,
    );
  });

  it('reconciles a committed save whose HTTP response was lost', () => {
    const pending = beginOrRetryToolSave({
      pending: null,
      ownerId: owner,
      projectId: project,
      toolId: tool,
      expected: 0,
      name: 'Plywood estimator',
      configuration: sampleEstimatorConfig(),
      note: 'User saved estimator revision',
      nextIds: { toolId: tool, requestId: request },
    }).snapshot;
    const committed = findCommittedToolSave(
      [
        {
          id: request,
          tool_id: tool,
          project_id: project,
          person_id: owner,
          revision: 1,
          name: 'Plywood estimator',
          configuration: sampleEstimatorConfig(),
          note: 'User saved estimator revision',
        },
      ],
      pending,
    );
    expect(committed?.revision).toBe(1);
    const laterDraft = { ...sampleEstimatorConfig(), assumptions: 'Edited after the lost response.' };
    const accepted = acceptToolSaveReceipt({
      pending,
      receipt: { personId: owner, toolId: tool, requestId: request, revision: 1 },
      currentOwnerId: owner,
      currentProjectId: project,
      currentName: 'Plywood estimator',
      currentConfiguration: laterDraft,
    });
    expect(accepted.status).toBe('applied');
    expect(accepted.draftStillUnsaved).toBe(true);
    expect(accepted.expected).toBe(1);
  });

  it('ignores a delayed receipt after owner or project change', () => {
    const pending = beginOrRetryToolSave({
      pending: null,
      ownerId: owner,
      projectId: project,
      toolId: tool,
      expected: 0,
      name: 'Plywood estimator',
      configuration: sampleEstimatorConfig(),
      note: 'User saved estimator revision',
      nextIds: { toolId: tool, requestId: request },
    }).snapshot;
    const accepted = acceptToolSaveReceipt({
      pending,
      receipt: { personId: owner, toolId: tool, requestId: request, revision: 1 },
      currentOwnerId: owner,
      currentProjectId: '00000000-0000-4000-8000-000000000099',
      currentName: pending.name,
      currentConfiguration: pending.configuration,
    });
    expect(accepted.status).toBe('ignored-stale-scope');
    expect(accepted.pendingCleared).toBe(false);
  });

  it('recovers a committed save when JSONB key order differs', () => {
    const pending = beginOrRetryToolSave({
      pending: null,
      ownerId: owner,
      projectId: project,
      toolId: tool,
      expected: 0,
      name: 'Plywood estimator',
      configuration: sampleEstimatorConfig(),
      note: 'User saved estimator revision',
      nextIds: { toolId: tool, requestId: request },
    }).snapshot;
    const shuffled = {
      ...sampleEstimatorConfig(),
      items: [...sampleEstimatorConfig().items].reverse(),
    };
    expect(
      findCommittedToolSave(
        [
          {
            id: request,
            tool_id: tool,
            project_id: project,
            person_id: owner,
            revision: 1,
            name: 'Plywood estimator',
            configuration: {
              assumptions: pending.configuration.assumptions,
              items: pending.configuration.items,
              markup_percent: pending.configuration.markup_percent,
              waste_percent: pending.configuration.waste_percent,
              rounding: pending.configuration.rounding,
              currency: pending.configuration.currency,
              kind: pending.configuration.kind,
            },
            note: 'User saved estimator revision',
          },
        ],
        pending,
      )?.revision,
    ).toBe(1);
    expect(
      findCommittedToolSave(
        [
          {
            id: request,
            tool_id: tool,
            project_id: project,
            person_id: owner,
            revision: 1,
            name: 'Plywood estimator',
            configuration: shuffled,
            note: 'User saved estimator revision',
          },
        ],
        pending,
      ),
    ).toBeNull();
  });

  it('does not mark an empty hydrated Tool panel dirty, and treats refresh failure as confirmed', () => {
    const empty = sampleEstimatorConfig();
    expect(
      isToolDraftDirty({
        pending: false,
        hydrated: true,
        baseline: { name: 'Quantity and cost estimator', configuration: empty },
        name: 'Quantity and cost estimator',
        configuration: empty,
        restoredDirty: false,
      }),
    ).toBe(false);
    expect(
      isToolDraftDirty({
        pending: false,
        hydrated: false,
        baseline: null,
        name: 'Quantity and cost estimator',
        configuration: empty,
        restoredDirty: false,
      }),
    ).toBe(false);
    expect(
      isToolDraftDirty({
        pending: false,
        hydrated: true,
        baseline: { name: 'Quantity and cost estimator', configuration: empty },
        name: 'Quantity and cost estimator',
        configuration: { ...empty, waste_percent: '20' },
        restoredDirty: false,
      }),
    ).toBe(true);
    expect(toolLibraryRefreshFollowUp({ writeConfirmed: false, libraryRefreshed: false })).toEqual({
      pending: true,
      refreshNeeded: false,
      retryCommittedWrite: true,
    });
    expect(toolLibraryRefreshFollowUp({ writeConfirmed: true, libraryRefreshed: false })).toEqual({
      pending: false,
      refreshNeeded: true,
      retryCommittedWrite: false,
    });
    expect(toolLibraryRefreshFollowUp({ writeConfirmed: true, libraryRefreshed: true })).toEqual({
      pending: false,
      refreshNeeded: false,
      retryCommittedWrite: false,
    });
  });
});
