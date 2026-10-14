import { createHash } from 'node:crypto';
import type { BriefScope, SourceSnapshot } from './schema';

export function sha256Text(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function treeHash(files: { path: string; content: string }[]) {
  return sha256Text(
    [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => `${file.path}:${sha256Text(file.content)}`)
      .join('\n'),
  );
}

export function approvalHash(scope: BriefScope) {
  return sha256Text(JSON.stringify(scope));
}

export function labeledSource(
  kind: SourceSnapshot['kind'],
  repository: string | null,
  commit: string | null,
  options: { modified?: boolean } = {},
) {
  if (kind === 'fixture')
    return 'Deterministic fixture source — labelled test tree, not an imported application snapshot.';
  if (kind === 'imported' && options.modified)
    return `Imported/modified snapshot${repository ? ` of ${repository}` : ''}${commit ? ` at ${commit}` : ''} — files were edited after a Git pin and are not verified unchanged Git content.`;
  if (kind === 'imported')
    return `Imported source snapshot${repository ? ` of ${repository}` : ''}${commit ? ` at ${commit}` : ''} — exact attached files, not live repository knowledge.`;
  return `Git pin ${repository}@${commit}. Missing imported tree is a blocker; Architect will not invent repository files.`;
}
