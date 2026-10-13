import { describe, expect, it } from 'vitest';
import {
  fixtureOutputCaption,
  isInFlightStatus,
  lifecyclePhase,
  runningServerPreviewAvailable,
  runningServerPreviewReason,
} from '@/domains/architect-construct/lifecycle';
import {
  newerGeneration,
  selectCurrentRun,
  selectLastSuccessfulRun,
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

  it('never offers a running-server preview and labels fixture output as test output', () => {
    expect(runningServerPreviewAvailable()).toBe(false);
    expect(runningServerPreviewReason('process-fixture')).toMatch(/not proof of an isolated AI build/i);
    expect(runningServerPreviewReason('docker')).toMatch(/static files only/i);
    expect(fixtureOutputCaption(4)).toMatch(/Revision 4/);
    expect(isInFlightStatus('queued')).toBe(true);
    expect(lifecyclePhase('cancelled')).toBe('canceled');
    expect(newerGeneration(2, 1)).toBe(false);
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
});
