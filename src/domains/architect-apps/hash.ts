import { sha256Text, treeHash } from '@/domains/architect-construct/hash';
import type { AppFile } from './schema';

export { sha256Text, treeHash };

export function fileHash(content: string) {
  return sha256Text(content);
}

export function artifactManifestHash(files: AppFile[]) {
  return treeHash(files);
}

export function appApprovalHash(scope: {
  treeHash: string;
  collections: unknown;
  behaviors: unknown;
  profile: string;
  profileVersion: string;
  toolchain: string;
}) {
  return sha256Text(JSON.stringify(scope));
}

export function labeledAppSource(mode: 'fixture' | 'mock' | 'openai' | 'unknown') {
  if (mode === 'fixture')
    return 'Deterministic fixture application — labelled development evidence, not a live model generation.';
  if (mode === 'mock')
    return 'Labelled mocked provider. This is not a paid OpenAI call and not a model-generated application.';
  if (mode === 'openai') return 'Model-generated application files recorded from the authorized OpenAI adapter.';
  return 'Generation provenance is unknown. Missing history is not labelled as a live model-generated result.';
}
