import { describe, expect, it } from 'vitest';
import {
  fixtureOutputCaption,
  isInFlightStatus,
  lifecyclePhase,
  runningServerPreviewAvailable,
  runningServerPreviewReason,
} from '@/domains/architect-construct/lifecycle';
import {
  constructInputSnapshot,
  newerGeneration,
  sameConstructContext,
  selectCurrentRun,
  selectLastSuccessfulRun,
  selectRepairJourney,
  selectRetainedConstructPreview,
  viewConstructLifecycle,
  type ConstructLifecycleLibrary,
} from '@/components/architect-origin/construct-lifecycle';
import { previewCaption } from '@/domains/architect-origin/preview-contract';

const projectA = '11111111-1111-4111-8111-111111111111';
const projectB = '33333333-3333-4333-8333-333333333333';
const ownerA = '22222222-2222-4222-8222-222222222222';
const runA = '55555555-5555-4555-8555-555555555555';
const runB = '66666666-6666-4666-8666-666666666666';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);

function library(): ConstructLifecycleLibrary {
  return {
    project: { id: projectA, revision: 2, name: 'Alpha' },
    runs: [
      {
        id: runB,
        person_id: ownerA,
        project_id: projectA,
        project_revision: 2,
        source_tree_hash: hashA,
        status: 'running',
        result: null,
      },
      {
        id: runA,
        person_id: ownerA,
        project_id: projectA,
        project_revision: 1,
        source_tree_hash: hashA,
        status: 'succeeded',
        result: {
          isolation: 'docker',
          runtime_available: true,
          sandbox: true,
          blocker: null,
          source_hash: hashA,
          result_hash: hashB,
          changed_files: ['preview.html'],
          diff: '',
          checks: [{ name: 'heading', status: 'passed', command: 'node check.mjs', exit_code: 0, log: '' }],
          preview: { path: 'preview.html', body: '<html><body>After</body></html>', unavailable_reason: null },
        },
      },
    ],
  };
}

describe('construct lifecycle selection', () => {
  it('keeps the current in-flight run and last success for the same project only', () => {
    const view = viewConstructLifecycle({
      library: library(),
      projectId: projectA,
      ownerId: ownerA,
      revision: 2,
      generation: 3,
    });
    expect(view.building).toBe(true);
    expect(view.phase).toBe('running');
    expect(view.current?.id).toBe(runB);
    expect(view.lastSuccess?.id).toBe(runA);
    expect(view.decision?.kind).toBe('construct-html');
    expect(view.decision && view.decision.kind !== 'unavailable' && view.decision.provenance).toBe(
      'last-successful-revision',
    );
    expect(selectCurrentRun(library(), projectB, ownerA)).toBeNull();
    expect(selectLastSuccessfulRun(library(), projectB, ownerA)).toBeNull();
  });

  it('retains labelled successful A through queued, running, failed and cancelled B', () => {
    const ownerB = '99999999-9999-4999-8999-999999999999';
    const previewA = '<html><body>After</body></html>';
    const previewB = '<html><body>Preview B</body></html>';
    const successA = library().runs![1]!;
    const nextB = (status: 'queued' | 'running' | 'failed' | 'cancelled' | 'succeeded', result: unknown) => {
      const base = library();
      return {
        ...base,
        runs: [
          {
            ...base.runs![0]!,
            status,
            result,
          },
          successA,
        ],
      } as ConstructLifecycleLibrary;
    };
    const expectRetainedA = (status: 'queued' | 'running' | 'failed' | 'cancelled') => {
      const selected = selectRetainedConstructPreview({
        library: nextB(status, null),
        ownerId: ownerA,
        projectId: projectA,
      });
      expect(selected.body).toBe(previewA);
      expect(selected.stale).toBe(true);
      expect(selected.revision).toBe(1);
      expect(selected.artifactId).toBe(runA);
      expect(selected.label).toMatch(/Last successful revision 1/);
      expect(selected.label).toMatch(/not the current attempt/i);
      expect(selected.body).not.toBe(previewB);
    };
    expectRetainedA('queued');
    expectRetainedA('running');
    expectRetainedA('failed');
    expectRetainedA('cancelled');

    const replaced = selectRetainedConstructPreview({
      library: nextB('succeeded', {
        isolation: 'docker',
        runtime_available: true,
        sandbox: true,
        blocker: null,
        source_hash: hashB,
        result_hash: hashA,
        changed_files: ['preview.html'],
        diff: '',
        checks: [],
        preview: { path: 'preview.html', body: previewB, unavailable_reason: null },
      }),
      ownerId: ownerA,
      projectId: projectA,
    });
    expect(replaced.body).toBe(previewB);
    expect(replaced.stale).toBe(false);
    expect(replaced.revision).toBe(2);
    expect(replaced.label).toMatch(/Current Construct output · revision 2/);

    const malformed = selectRetainedConstructPreview({
      library: nextB('succeeded', {
        isolation: 'docker',
        runtime_available: true,
        sandbox: true,
        blocker: null,
        source_hash: 'not-a-hash',
        result_hash: 'also-bad',
        changed_files: [],
        diff: '',
        checks: [],
        preview: { path: 'preview.html', body: previewB, unavailable_reason: null },
      }),
      ownerId: ownerA,
      projectId: projectA,
    });
    expect(malformed.body).toBe(previewA);
    expect(malformed.stale).toBe(true);

    const foreign = selectRetainedConstructPreview({
      library: library(),
      ownerId: ownerB,
      projectId: projectA,
      held: successA,
    });
    expect(foreign.body).toBeNull();
    expect(
      selectRetainedConstructPreview({
        library: library(),
        ownerId: ownerA,
        projectId: projectB,
        held: successA,
      }).body,
    ).toBeNull();
  });

  it('never offers a running-server preview and labels fixture output as test output', () => {
    expect(runningServerPreviewAvailable()).toBe(false);
    expect(runningServerPreviewReason('process-fixture')).toMatch(/not proof of an isolated AI build/i);
    expect(runningServerPreviewReason('docker')).toMatch(/static files only/i);
    expect(fixtureOutputCaption(4)).toMatch(/Revision 4/);
    expect(isInFlightStatus('queued')).toBe(true);
    expect(lifecyclePhase('cancelled')).toBe('canceled');
    expect(newerGeneration(2, 1)).toBe(false);
    expect(
      sameConstructContext(
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 2 },
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 2 },
      ),
    ).toBe(true);
    expect(
      sameConstructContext(
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 2 },
        { ownerId: ownerA, projectId: projectB, revision: 1, generation: 3 },
      ),
    ).toBe(false);
    expect(
      sameConstructContext(
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 3 },
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 2 },
      ),
    ).toBe(false);
    expect(
      sameConstructContext(
        { ownerId: ownerA, projectId: projectA, revision: 1, generation: 2 },
        { ownerId: ownerA, projectId: projectA, revision: 2, generation: 3 },
      ),
    ).toBe(false);
    const snapshot = constructInputSnapshot({
      sourceKind: 'imported',
      repository: null,
      commit: '',
      files: [{ path: 'preview.html', content: 'Before' }],
      intendedChange: 'Replace the heading.',
      revision: 1,
    });
    expect(
      constructInputSnapshot({
        sourceKind: 'imported',
        repository: null,
        commit: '',
        files: [{ path: 'preview.html', content: 'Edited' }],
        intendedChange: 'Replace the heading.',
        revision: 1,
      }),
    ).not.toBe(snapshot);
    expect(
      constructInputSnapshot({
        sourceKind: 'imported',
        repository: null,
        commit: '',
        files: [{ path: 'preview.html', content: 'Before' }],
        intendedChange: 'Replace the heading.',
        revision: 2,
      }),
    ).not.toBe(snapshot);
    expect(previewCaption({
      kind: 'construct-html',
      identity: {
        projectId: projectA,
        ownerId: ownerA,
        revision: 1,
        artifactId: runA,
        sourceHash: hashA,
        resultHash: hashB,
        persisted: true,
      },
      srcDoc: '<html></html>',
      markdown: null,
      path: 'preview.html',
      labelledDemonstration: false,
      provenance: 'construct-fixture',
    })).toMatch(/fixture test output/i);
  });

  it('keeps the original attempt distinct from an enqueued repair and restores durable stages', () => {
    const original = {
      id: runA,
      person_id: ownerA,
      project_id: projectA,
      project_revision: 1,
      source_tree_hash: hashA,
      status: 'failed',
      parent_run_id: null,
      result: {
        isolation: 'process-fixture',
        runtime_available: false,
        sandbox: false,
        blocker: 'introduced',
        source_hash: hashA,
        result_hash: null,
        checks: [],
        changed_files: ['ok.mjs'],
        preview: { path: null, body: '', unavailable_reason: 'failed' },
      },
    };
    const repair = {
      id: runB,
      person_id: ownerA,
      project_id: projectA,
      project_revision: 1,
      source_tree_hash: hashA,
      status: 'queued',
      parent_run_id: runA,
      result: null,
    };
    const loaded = selectRepairJourney({
      library: {
        project: { id: projectA, revision: 1, name: 'Alpha' },
        runs: [repair, original],
        briefs: [
          {
            id: runB,
            status: 'approved',
            scope: {
              intended_change: `Repair of run ${runA}`,
              project_revision: 1,
              patch: [{ path: 'ok.mjs', before: 'Before', after: 'After' }],
              repair: { kind: 'check-driven', parent_run_id: runA, targets: ['syntax:ok.mjs'] },
            },
          },
        ],
      },
      ownerId: ownerA,
      projectId: projectA,
    });
    expect(loaded.original?.id).toBe(runA);
    expect(loaded.repair?.id).toBe(runB);
    expect(loaded.steps).toEqual({
      original: true,
      observedFailure: true,
      proposed: true,
      approved: true,
      observedResult: false,
    });
    const current = selectCurrentRun(
      { project: { id: projectA, revision: 1 }, runs: [repair, original] },
      projectA,
      ownerA,
    );
    expect(current?.id).toBe(runB);
    expect(current?.parent_run_id).toBe(runA);
  });

  it('restores an approved unstarted repair from the read contract without inventing a child run', () => {
    const original = {
      id: runA,
      person_id: ownerA,
      project_id: projectA,
      project_revision: 1,
      source_tree_hash: hashA,
      status: 'failed',
      parent_run_id: null,
      result: {
        isolation: 'process-fixture',
        runtime_available: false,
        sandbox: false,
        blocker: 'introduced',
        source_hash: hashA,
        result_hash: null,
        checks: [],
        changed_files: ['ok.mjs'],
        preview: { path: null, body: '', unavailable_reason: 'failed' },
      },
    };
    const loaded = selectRepairJourney({
      library: {
        project: { id: projectA, revision: 1, name: 'Alpha' },
        runs: [original],
        briefs: [],
        pendingRepair: {
          briefId: runB,
          requestId: runB,
          parentRunId: runA,
          approvalHash: hashB,
          status: 'approved',
          invalidationReason: null,
          projectRevision: 1,
          generation: { mode: 'mock', notes: 'Labelled demonstration. Not a paid OpenAI call.' },
          patch: [{ path: 'ok.mjs', before: 'Before', after: 'After' }],
          intendedChange: `Repair of run ${runA}`,
        },
      },
      ownerId: ownerA,
      projectId: projectA,
    });
    expect(loaded.original?.id).toBe(runA);
    expect(loaded.repair).toBeNull();
    expect(loaded.durableBrief?.id).toBe(runB);
    expect(loaded.durableBrief?.scope?.repair?.generation?.mode).toBe('mock');
    expect(loaded.steps).toEqual({
      original: true,
      observedFailure: true,
      proposed: true,
      approved: true,
      observedResult: false,
    });
  });
});
