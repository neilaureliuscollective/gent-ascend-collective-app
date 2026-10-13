import {
  defaultLimits,
  defaultProtectedPaths,
  type BriefScope,
  type SourceSnapshot,
} from './schema';
import { labeledSource, treeHash } from './hash';

export const fixtureRepository = 'neilaureliuscollective/gent-ascend-collective-app';
export const fixturePreviewPath = 'preview.html';

export function fixtureFiles() {
  return [
    {
      path: 'README.md',
      content:
        '# Architect construct fixture\n\nDeterministic labelled source for execution mechanics. This is not a model-generated Aethelios change.\n',
    },
    {
      path: fixturePreviewPath,
      content:
        '<!doctype html><html lang="en"><title>Architect fixture</title><h1>Before</h1><p>Harmless preview before the approved patch.</p></html>\n',
    },
    {
      path: 'check.mjs',
      content:
        "import { readFileSync } from 'node:fs';\nconst html = readFileSync('preview.html', 'utf8');\nif (!html.includes('<h1>After</h1>')) process.exit(1);\n",
    },
  ];
}

export function fixtureSource(personId: string, id: string, createdAt = new Date().toISOString()): SourceSnapshot {
  const files = fixtureFiles();
  return {
    id,
    person_id: personId,
    kind: 'fixture',
    repository: fixtureRepository,
    commit: null,
    label: labeledSource('fixture', fixtureRepository, null),
    tree_hash: treeHash(files),
    files,
    created_at: createdAt,
  };
}

export function importedFixtureSource(
  personId: string,
  id: string,
  createdAt = new Date().toISOString(),
): SourceSnapshot {
  const source = fixtureSource(personId, id, createdAt);
  return {
    ...source,
    kind: 'imported',
    label: labeledSource('imported', fixtureRepository, null),
  };
}

export function matchesCanonicalFixture(source: Pick<SourceSnapshot, 'files'>) {
  const expected = fixtureFiles();
  if (source.files.length !== expected.length) return false;
  const byPath = new Map(expected.map((file) => [file.path, file.content]));
  return (
    source.files.every((file) => byPath.get(file.path) === file.content) &&
    expected.every((file) => source.files.some((row) => row.path === file.path && row.content === file.content))
  );
}

export function fixtureScope(input: {
  projectId: string;
  projectRevision: number;
  sourceId: string;
  sourceTreeHash: string;
}): BriefScope {
  const before = fixtureFiles().find((file) => file.path === fixturePreviewPath)!.content;
  return {
    project_id: input.projectId,
    project_revision: input.projectRevision,
    source_id: input.sourceId,
    repository: fixtureRepository,
    source_commit: null,
    source_tree_hash: input.sourceTreeHash,
    allowed_paths: ['preview.html', 'README.md', 'check.mjs'],
    protected_paths: defaultProtectedPaths(),
    intended_change:
      'Replace the fixture heading Before with After. Prove patch, checks, diff and preview — not an Aethelios product feature.',
    acceptance_checks: [
      { name: 'syntax', command: 'node', args: ['--check', 'check.mjs'] },
      { name: 'heading', command: 'node', args: ['check.mjs'] },
    ],
    resource_limits: defaultLimits,
    patch: [
      {
        path: fixturePreviewPath,
        before,
        after: before.replace('<h1>Before</h1>', '<h1>After</h1>'),
      },
    ],
  };
}
