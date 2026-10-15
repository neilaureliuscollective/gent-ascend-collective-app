import type { DesignDirectionContent } from '@/domains/architect-design-direction/contract';
import { IntelligenceError } from '@/domains/intelligence/service';
import { APP_DATA_SCHEMA } from './schema';
import { isGeneratedAppPath, isSealedAppPath } from './catalog';
import { fileHash } from './hash';
import { assertAdditiveSchema } from './data-bridge';
import { MUTATION_CONFLICT, VERSION_CONFLICT } from './mutation';
import type { AppCollection, AppFile, AppProposal, FileOperation } from './schema';
import { applyFileOperations, overlaySealedFiles } from './tree';

export const APP_DATA_BRIDGE_CONTRACT = {
  schema: APP_DATA_SCHEMA,
  operations: ['list', 'get', 'create', 'update'] as const,
  persistence: 'host-managed',
  isolation: 'owner-app-collection',
  session: {
    format: 'v1.nonce.exp.mac',
    bootstrap: [
      'window.__AETHELIOS_APP_SESSION__',
      'window.__AETHELIOS_PARENT_ORIGIN__',
      'window.__AETHELIOS_APP_REVISION__',
      'window.__AETHELIOS_APP_GENERATION__',
    ],
    expiry: 'HMAC expiry plus in-process revocation. Replies bind to document/session/generation.',
  },
  request: {
    schema: APP_DATA_SCHEMA,
    session: 'string',
    requestId: 'uuid',
    operation: 'list | get | create | update',
    collection: 'string<=40',
    payload: 'object',
    idempotencyKey: 'stable operation identity, required for create/update',
    expectedVersion: 'positive integer for update; omit on create',
  },
  response: {
    schema: APP_DATA_SCHEMA,
    requestId: 'uuid matching the request',
    ok: 'boolean',
    records: 'array of { id, persisted, version, ...collection fields }',
    error: 'string when ok is false',
  },
  replay: {
    identity: 'Each user mutation intent has one idempotency key bound to an immutable payload snapshot.',
    retry: 'Reuse that key and payload only after an uncertain result (timeout or lost acknowledgment).',
    success: 'After a confirmed save, the next different edit must mint a new identity.',
    changedPayload: MUTATION_CONFLICT,
    concurrent: VERSION_CONFLICT,
  },
  examples: {
    create: {
      operation: 'create',
      collection: 'notes',
      idempotencyKey: '00000000-0000-4000-8000-000000000851',
      payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit', body: 'North wall', hours: 2 },
    },
    update: {
      operation: 'update',
      collection: 'notes',
      idempotencyKey: '00000000-0000-4000-8000-000000000852',
      expectedVersion: 1,
      payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit edited', body: 'North wall', hours: 3 },
    },
  },
  errors: {
    expiredSession: 403,
    unknownCollection: 404,
    validation: 400,
    mutationConflict: 409,
    versionConflict: 409,
    quota: 409,
  },
  boundaries: [
    'Generated apps persist only through this host collection bridge.',
    'They cannot open parent cookies, localStorage, or service workers.',
    'Iframe fields never overwrite owner, project, or revision.',
    'Collections are additive. Existing field types cannot change.',
  ],
  note: 'Generated apps persist only through the host collection bridge. They cannot open parent storage or service workers.',
} as const;

export type AppGenerationFile = {
  path: string;
  content: string;
  hash: string;
};

export type AppGenerationDirection = {
  schema: string;
  identity?: DesignDirectionContent['identity'];
  designSnapshot?: DesignDirectionContent['designSnapshot'];
  name?: string;
  summary?: string;
  digest?: string;
  verified?: boolean;
  sourceKind?: string;
  colors?: Array<{ role: string; value: string }>;
  typography?: string[];
  layout?: string[];
  copy?: { title?: string; approved?: string[] };
  assets?: Array<{ id: string; kind: string; provenance: string; href?: string; note?: string }>;
  unsupported?: string[];
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

export function supportedDirectionForGeneration(direction?: {
  schema?: string;
  identity?: DesignDirectionContent['identity'];
  designSnapshot?: DesignDirectionContent['designSnapshot'];
  name?: string;
  summary?: string;
  digest?: string;
  verified?: boolean;
  sourceKind?: string;
  colors?: Array<{ role: string; value: string }>;
  typography?: string[];
  layout?: string[];
  copy?: { title?: string; approved?: string[] };
  assets?: Array<{ id: string; kind: string; provenance: string; href?: string; note?: string }>;
} | null): AppGenerationDirection {
  if (!direction) return null;
  return {
    schema: direction.schema ?? 'talk-architect-direction/v1',
    identity: direction.identity,
    designSnapshot: direction.designSnapshot,
    name: direction.name,
    summary: direction.summary,
    digest: direction.digest,
    verified: direction.verified,
    sourceKind: direction.sourceKind,
    colors: direction.colors ?? [],
    typography: direction.typography ?? [],
    layout: direction.layout ?? [],
    copy: direction.copy,
    assets: (direction.assets ?? []).map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      provenance: asset.provenance,
      href: asset.href,
      note: asset.note,
    })),
    unsupported: [
      'Arbitrary fonts, photography, or 3D scenes not listed in assets[].',
      'Colors outside the approved role tokens.',
      'Independent authentication, payments, or publishing.',
    ],
  };
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
    direction: supportedDirectionForGeneration(input.direction),
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
