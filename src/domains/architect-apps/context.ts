import { IntelligenceError } from '@/domains/intelligence/service';
import { APP_DATA_SCHEMA } from './schema';
import { isGeneratedAppPath, isSealedAppPath } from './catalog';
import { fileHash } from './hash';
import { assertAdditiveSchema } from './data-bridge';
import type { AppCollection, AppFile, AppProposal, FileOperation } from './schema';
import { applyFileOperations, overlaySealedFiles } from './tree';

export const APP_DATA_BRIDGE_CONTRACT = {
  schema: APP_DATA_SCHEMA,
  operations: ['list', 'get', 'create', 'update'] as const,
  persistence: 'host-managed',
  isolation: 'owner-app-collection',
  note: 'Generated apps persist only through the host collection bridge. They cannot open parent storage or service workers.',
} as const;

export type AppGenerationFile = {
  path: string;
  content: string;
  hash: string;
};

export type AppGenerationDirection = {
  schema: string;
  name?: string;
  summary?: string;
  digest?: string;
  verified?: boolean;
  sourceKind?: string;
} | null;

export type AppGenerationContext = {
  instruction: string;
  kind: 'create' | 'revise';
  files: AppGenerationFile[];
  collections: AppCollection[];
  bridge: typeof APP_DATA_BRIDGE_CONTRACT;
  brief?: string;
  direction?: AppGenerationDirection;
};

export function hashedAppFiles(files: AppFile[]): AppGenerationFile[] {
  return files
    .filter((file) => isGeneratedAppPath(file.path) && !isSealedAppPath(file.path))
    .map((file) => ({
      path: file.path,
      content: file.content,
      hash: fileHash(file.content),
    }));
}

export function buildAppGenerationContext(input: {
  instruction: string;
  kind: 'create' | 'revise';
  files: AppFile[];
  collections?: AppCollection[];
  brief?: string;
  direction?: AppGenerationDirection;
}): AppGenerationContext {
  return {
    instruction: input.instruction.slice(0, 2000),
    kind: input.kind,
    files: hashedAppFiles(input.files),
    collections: input.collections ?? [],
    bridge: APP_DATA_BRIDGE_CONTRACT,
    brief: input.brief?.slice(0, 2000),
    direction: input.direction ?? null,
  };
}

export function validateProposalAgainstContext(proposal: AppProposal, context: AppGenerationContext) {
  const byPath = new Map(context.files.map((file) => [file.path, file]));
  for (const file of proposal.files) {
    if (!isGeneratedAppPath(file.path) || isSealedAppPath(file.path))
      throw new IntelligenceError('Generated applications may only return files under src/.', 409);
  }
  if (context.kind === 'revise' && context.files.length) {
    if (!proposal.operations?.length)
      throw new IntelligenceError('A revision must bind update and delete operations to exact base hashes.', 409);
    for (const operation of proposal.operations) {
      validateOperationAgainstContext(operation, byPath);
    }
    applyFileOperations(
      overlaySealedFiles(context.files.map((file) => ({ path: file.path, content: file.content }))),
      proposal.operations,
    );
  }
  if (context.collections.length) assertAdditiveSchema(context.collections, proposal.collections);
  return proposal;
}

function validateOperationAgainstContext(
  operation: FileOperation,
  byPath: Map<string, AppGenerationFile>,
) {
  if (!isGeneratedAppPath(operation.path) || isSealedAppPath(operation.path))
    throw new IntelligenceError('Generated applications may only change files under src/.', 409);
  if (operation.op === 'create') return;
  const base = byPath.get(operation.path);
  if (!base) throw new IntelligenceError(`Revision is missing the exact base file ${operation.path}.`, 409);
  if (!operation.baseHash || operation.baseHash !== base.hash)
    throw new IntelligenceError(
      `Update and delete must bind the exact base content hash for ${operation.path}. Paths and character counts cannot support exact-base revisions.`,
      409,
    );
}
