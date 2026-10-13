import { describe, expect, it } from 'vitest';
import {
  bindPreviewIdentity,
  decideConstructPreview,
  looksLikeHtml,
  previewCaption,
  rejectPreviewUrl,
  retainHeldPreview,
  samePreviewOwnerProject,
} from '@/domains/architect-origin/preview-contract';
import {
  isolateStaticHtml,
  LABELLED_DEMONSTRATION_HTML,
  documentPreviewMode,
} from '@/domains/architect-origin/static-preview';
import {
  decideFromLibrary,
  selectTrustedConstructReceipt,
  type ConstructLibraryEnvelope,
} from '@/components/architect-origin/construct-preview-adapter';

const projectA = '11111111-1111-4111-8111-111111111111';
const projectB = '33333333-3333-4333-8333-333333333333';
const ownerA = '22222222-2222-4222-8222-222222222222';
const ownerB = '44444444-4444-4444-8444-444444444444';
const runA = '55555555-5555-4555-8555-555555555555';
const runB = '66666666-6666-4666-8666-666666666666';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);

const identity = bindPreviewIdentity({
  projectId: projectA,
  ownerId: ownerA,
  revision: 3,
  sourceHash: hashA,
  resultHash: hashB,
})!;

function succeededRun(overrides: Record<string, unknown> = {}) {
  return {
    id: runA,
    person_id: ownerA,
    project_id: projectA,
    project_revision: 3,
    source_tree_hash: hashA,
    status: 'succeeded',
    result: {
      isolation: 'process-fixture',
      runtime_available: true,
      sandbox: false,
      blocker: null,
      source_hash: hashA,
      result_hash: hashB,
      changed_files: ['index.html'],
      diff: '',
      checks: [],
      preview: {
        path: 'index.html',
        body: '<html><body>Owned</body></html>',
        unavailable_reason: null,
      },
    },
    ...overrides,
  };
}

function libraryFor(
  runs: ConstructLibraryEnvelope['runs'],
  projectId = projectA,
): ConstructLibraryEnvelope {
  return { project: { id: projectId, revision: 3, name: 'Synthetic' }, runs };
}

describe('preview contract', () => {
  it('binds revision identity and rejects incomplete hashes', () => {
    expect(identity.revision).toBe(3);
    expect(identity.persisted).toBe(true);
    expect(
      bindPreviewIdentity({
        projectId: identity.projectId,
        ownerId: identity.ownerId,
        revision: 1,
        sourceHash: 'not-a-hash',
      }),
    ).toBeNull();
  });

  it('rejects foreign or credentialed preview URLs', () => {
    expect(rejectPreviewUrl('https://evil.example/preview')).toMatch(/configured|trusted origin/);
    expect(rejectPreviewUrl('javascript:alert(1)')).toMatch(/scriptable/);
    expect(rejectPreviewUrl('https://user:pass@example.com')).toMatch(/credentials/);
    expect(rejectPreviewUrl('https://preview.example/app', ['https://preview.example'])).toBeNull();
  });

  it('does not accept another owner or project construct preview', () => {
    const foreign = decideConstructPreview({
      identity,
      preview: {
        path: 'index.html',
        body: '<html><body>Hi</body></html>',
        unavailable_reason: null,
      },
      ownerMatches: false,
      projectMatches: true,
    });
    expect(foreign.kind).toBe('unavailable');
    const otherProject = decideFromLibrary(
      libraryFor([
        succeededRun({
          id: runB,
          project_id: projectB,
          person_id: ownerA,
        }),
      ]),
      identity,
    );
    expect(otherProject.kind).toBe('unavailable');
    expect(otherProject.kind === 'unavailable' && otherProject.reason).toMatch(/different project/);
  });

  it('keeps a labelled demonstration distinct from live artifacts', () => {
    expect(LABELLED_DEMONSTRATION_HTML).toMatch(/Labelled demonstration/);
    expect(looksLikeHtml(LABELLED_DEMONSTRATION_HTML)).toBe(true);
    expect(documentPreviewMode('# Heading')).toBe('markdown');
  });
});

describe('construct receipt selection', () => {
  it('rejects missing identity instead of treating blank IDs as a match', () => {
    const decided = decideFromLibrary(
      libraryFor([
        {
          status: 'succeeded',
          result: {
            preview: {
              path: 'index.html',
              body: '<html><body>Anonymous</body></html>',
              unavailable_reason: null,
            },
          },
        },
      ]),
      identity,
    );
    expect(decided.kind).toBe('unavailable');
    expect(decided.kind === 'unavailable' && decided.reason).toMatch(/missing required identity/);
  });

  it('does not blindly choose runs[0] when a later receipt matches', () => {
    const decided = decideFromLibrary(
      libraryFor([
        succeededRun({
          id: runB,
          person_id: ownerB,
          project_id: projectB,
          project_revision: 9,
          result: {
            isolation: 'process-fixture',
            runtime_available: true,
            sandbox: false,
            blocker: null,
            source_hash: hashA,
            result_hash: hashB,
            changed_files: [],
            diff: '',
            checks: [],
            preview: {
              path: 'index.html',
              body: '<html><body>Foreign first</body></html>',
              unavailable_reason: null,
            },
          },
        }),
        succeededRun({
          result: {
            isolation: 'process-fixture',
            runtime_available: true,
            sandbox: false,
            blocker: null,
            source_hash: hashA,
            result_hash: hashB,
            changed_files: [],
            diff: '',
            checks: [],
            preview: {
              path: 'index.html',
              body: '<html><body>Matching later</body></html>',
              unavailable_reason: null,
            },
          },
        }),
      ]),
      identity,
    );
    expect(decided.kind).toBe('construct-html');
    expect(decided.kind !== 'unavailable' && decided.srcDoc).toMatch(/Matching later/);
    expect(decided.kind !== 'unavailable' && decided.identity.revision).toBe(3);
    expect(decided.kind !== 'unavailable' && decided.identity.artifactId).toBe(runA);
  });

  it('rejects malformed ownership and unverified copied hashes', () => {
    expect(
      selectTrustedConstructReceipt(libraryFor([succeededRun({ person_id: ownerB })]), identity)
        .status,
    ).toBe('rejected');
    expect(
      decideFromLibrary(
        libraryFor([
          succeededRun({
            result: {
              isolation: 'process-fixture',
              runtime_available: true,
              sandbox: false,
              blocker: null,
              source_hash: 'not-a-hash',
              result_hash: hashB,
              preview: {
                path: 'index.html',
                body: '<html><body>Bad hash</body></html>',
                unavailable_reason: null,
              },
            },
          }),
        ]),
        identity,
      ).kind,
    ).toBe('unavailable');
    expect(
      decideFromLibrary({ runs: [succeededRun()] }, identity).kind,
    ).toBe('unavailable');
  });

  it('labels an older same-project receipt with its own revision', () => {
    const decided = decideFromLibrary(
      libraryFor([
        succeededRun({
          project_revision: 1,
          result: {
            isolation: 'docker',
            runtime_available: true,
            sandbox: true,
            blocker: null,
            source_hash: hashA,
            result_hash: hashB,
            changed_files: [],
            diff: '',
            checks: [],
            preview: {
              path: 'index.html',
              body: '<html><body>Revision one</body></html>',
              unavailable_reason: null,
            },
          },
        }),
      ]),
      identity,
    );
    expect(decided.kind).toBe('construct-html');
    expect(decided.kind !== 'unavailable' && decided.identity.revision).toBe(1);
    expect(previewCaption(decided, { stale: true })).toMatch(/Revision 1/);
    expect(previewCaption(decided, { stale: true })).toMatch(/last working revision shown/);
  });

  it('keeps in-progress runs honest instead of fabricating a preview', () => {
    const decided = decideFromLibrary(
      libraryFor([
        succeededRun({
          status: 'running',
          result: null,
        }),
      ]),
      identity,
    );
    expect(decided.kind).toBe('unavailable');
    expect(decided.kind === 'unavailable' && decided.reason).toMatch(/does not refresh execution/);
  });
});

describe('held preview recovery', () => {
  it('clears cross-project held output and keeps same-project stale revisions', () => {
    const held = decideFromLibrary(libraryFor([succeededRun()]), identity);
    expect(samePreviewOwnerProject(held, projectA, ownerA)).toBe(true);
    expect(retainHeldPreview(held, projectB, ownerA)).toBeNull();
    expect(retainHeldPreview(held, projectA, ownerB)).toBeNull();
    expect(retainHeldPreview(held, projectA, ownerA)?.kind).toBe('construct-html');
  });
});

describe('saved versus draft captions', () => {
  it('does not call an unsaved draft an actual saved document', () => {
    const draftIdentity = bindPreviewIdentity({
      projectId: projectA,
      ownerId: ownerA,
      revision: 2,
      artifactId: runA,
      persisted: false,
    })!;
    const draft = {
      kind: 'markdown-document' as const,
      identity: draftIdentity,
      srcDoc: null,
      markdown: '# Draft',
      path: null,
      labelledDemonstration: false,
      provenance: 'unsaved-draft' as const,
    };
    const saved = {
      ...draft,
      provenance: 'saved-document' as const,
      identity: { ...draftIdentity, persisted: true },
    };
    expect(previewCaption(draft)).toMatch(/Unsaved draft preview/);
    expect(previewCaption(draft)).not.toMatch(/Actual saved document/);
    expect(previewCaption(saved)).toMatch(/Actual saved document/);
    expect(previewCaption(saved)).toMatch(/Revision 2/);
  });
});

describe('isolated static HTML', () => {
  it('strips scripts, handlers and javascript URLs', () => {
    const isolated = isolateStaticHtml(
      `<html><body><script>window.pwned=true</script><a href="javascript:alert(1)" onclick="alert(2)">Go</a><iframe src="https://evil"></iframe></body></html>`,
    );
    expect(isolated.srcDoc).not.toMatch(/<script/i);
    expect(isolated.srcDoc).not.toMatch(/javascript:/i);
    expect(isolated.srcDoc).not.toMatch(/onclick/i);
    expect(isolated.srcDoc).not.toMatch(/<iframe/i);
    expect(isolated.srcDoc).toMatch(/Content-Security-Policy/);
    expect(isolated.blocked).toEqual(
      expect.arrayContaining(['forbidden-tags', 'event-handlers', 'dangerous-urls']),
    );
  });
});
