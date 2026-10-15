import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { readRetainedDirection } from '@/domains/architect-design-direction/receiver';
import { APP_PROFILE, APP_PROFILE_VERSION, APP_TOOLCHAIN_VERSION } from './catalog';
import { DatabaseAppStore, type AppPersistenceClient } from './database-store';
import { assertAdditiveSchema, assertDataRate, recordToItem, validateCollectionPayload } from './data-bridge';
import { appGenerationProvenance, appProviderStatus, generateAppProposal, type AppGenerationTransport } from './generation';
import { appApprovalHash, treeHash } from './hash';
import {
  DatabasePreviewSessionStore,
  assemblePreviewDocument,
  defaultPreviewSessionStore,
  previewSessionGeneration,
  revisionAllowsPreview,
  signPreviewSession,
  verifyPreviewSession,
  type PreviewSessionStore,
} from './preview';
import { defaultAppGenerationTransport } from './provider';
import { appsProcessIdentity } from './commission';
import { appsReady, memoryAppStoreAllowed } from './readiness';
import {
  approveAppCommand,
  cancelAppCommand,
  proposeAppCommand,
  reopenAppCommand,
  startAppCommand,
  type AppCollection,
} from './schema';
import { AppStoreError, MemoryAppStore, type AppStore } from './store';
import { applyFileOperations, diffAppFiles, overlaySealedFiles } from './tree';

let memory: MemoryAppStore | null = null;

export function appStore(options?: { client?: AppPersistenceClient; plane?: 'owner' | 'worker' }): AppStore {
  if (memoryAppStoreAllowed()) {
    memory ??= new MemoryAppStore();
    return memory;
  }
  if (!options?.client)
    throw new AppStoreError(
      'Database-backed Architect Apps store is required outside labelled memory tests. Apply the additive apps migrations locally.',
      'unavailable',
    );
  return new DatabaseAppStore(options.client, options.plane ?? 'owner');
}

function previewStoreFor(client?: AppPersistenceClient): PreviewSessionStore {
  if (memoryAppStoreAllowed() || !client) return defaultPreviewSessionStore();
  return new DatabasePreviewSessionStore(client);
}

function requireReady() {
  if (!appsReady() && !memoryAppStoreAllowed())
    throw new IntelligenceError(
      'Architect applications are awaiting reviewed persistence and local enablement. Origin editing remains available.',
      503,
    );
}

function asIntelligence(error: unknown): never {
  if (error instanceof IntelligenceError) throw error;
  if (error instanceof AppStoreError)
    throw new IntelligenceError(error.message, error.code === 'not_found' ? 404 : 409);
  throw new IntelligenceError(error instanceof Error ? error.message : 'Application request could not be completed.', 503);
}

async function requireOwnedProject(projectId: string, expected?: number) {
  const { client, person } = await intelligenceSession();
  const owned = await client
    .from('architect_origin_projects')
    .select('id,person_id,revision,content')
    .eq('person_id', person.id)
    .eq('id', projectId)
    .maybeSingle();
  if (owned.error) throw new IntelligenceError('Project unavailable.', 503);
  if (!owned.data) throw new IntelligenceError('Project unavailable.', 404);
  if (expected != null && owned.data.revision !== expected)
    throw new IntelligenceError('Project revision changed. Reload before approving or starting this application.', 409);
  return {
    person,
    client: client as unknown as AppPersistenceClient,
    project: owned.data as {
      id: string;
      person_id: string;
      revision: number;
      content: { name?: string; blueprint?: { vision?: string } };
    },
  };
}

function scopeHash(input: {
  files: { path: string; content: string }[];
  collections: AppCollection[];
  behaviors: unknown;
}) {
  const files = overlaySealedFiles(input.files);
  return {
    files,
    treeHash: treeHash(files),
    approvalHash: appApprovalHash({
      treeHash: treeHash(files),
      collections: input.collections,
      behaviors: input.behaviors,
      profile: APP_PROFILE,
      profileVersion: APP_PROFILE_VERSION,
      toolchain: APP_TOOLCHAIN_VERSION,
    }),
  };
}

export async function readArchitectApp(projectId: string, selectedRevision?: number) {
  requireReady();
  try {
    const { person, client } = await requireOwnedProject(projectId);
    const store = appStore({ client, plane: 'owner' });
    const app = await store.readApp(person.id, projectId);
    const revisions = await store.listRevisions(person.id, projectId);
    const jobs = await store.listJobs(person.id, projectId);
    const current = revisions.find((row) => row.revision === app?.current_revision) ?? revisions[0] ?? null;
    const working =
      revisions.find((row) => row.revision === app?.last_working_revision && row.working) ??
      revisions.find((row) => row.working) ??
      null;
    const selected =
      selectedRevision != null
        ? revisions.find((row) => row.revision === selectedRevision) ?? null
        : current?.status === 'ready'
          ? current
          : working;
    const latestJob = jobs[0] ?? null;
    const events = latestJob ? await store.listEvents(person.id, latestJob.id) : [];
    const selectedArtifact = selected ? await store.readArtifact(person.id, selected.id) : null;
    const workingArtifact = working ? await store.readArtifact(person.id, working.id) : null;
    const previewRevision =
      selected && (selected.status === 'ready' || selected.working) && selectedArtifact ? selected : working;
    const previewArtifact =
      previewRevision?.id === selected?.id && selectedArtifact ? selectedArtifact : workingArtifact;
    const sessions = previewStoreFor(client);
    const session =
      previewRevision && previewArtifact && revisionAllowsPreview(previewRevision)
        ? await signPreviewSession({ personId: person.id, projectId, revisionId: previewRevision.id, store: sessions })
        : null;
    const preview =
      previewRevision && previewArtifact && session && revisionAllowsPreview(previewRevision)
        ? assemblePreviewDocument({
            artifacts: previewArtifact.files,
            session,
            parentOrigin: '*',
            title: app?.name,
            revision: previewRevision.revision,
            revisionId: previewRevision.id,
            generation: await previewSessionGeneration(previewRevision.id, sessions),
          })
        : null;
    const pendingStart =
      current &&
      current.status === 'approved' &&
      !jobs.some((job) => job.revision_id === current.id)
        ? {
            revisionId: current.id,
            requestId: current.id,
            approvalHash: current.approval_hash,
            revision: current.revision,
          }
        : null;
    const records = current
      ? Object.fromEntries(
          await Promise.all(
            current.collections.map(async (collection) => [
              collection.name,
              (await store.listRecords(person.id, app?.id ?? projectId, collection.name)).map(recordToItem),
            ]),
          ),
        )
      : {};
    return {
      app,
      revisions,
      jobs,
      events,
      current,
      working,
      selected,
      preview,
      previewSession: session,
      pendingStart,
      records,
      provider: appProviderStatus(),
      runtime: appsProcessIdentity(),
      profile: { id: APP_PROFILE, version: APP_PROFILE_VERSION, toolchain: APP_TOOLCHAIN_VERSION },
      capabilities: current?.behaviors ?? {
        navigation: false,
        forms: false,
        validation: false,
        filtering: false,
        calculations: false,
        persistence: false,
      },
    };
  } catch (error) {
    asIntelligence(error);
  }
}

export async function proposeArchitectApp(
  input: unknown,
  transport?: AppGenerationTransport,
) {
  requireReady();
  const parsed = proposeAppCommand.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the application proposal fields.', 400);
  try {
    const { person, project, client } = await requireOwnedProject(parsed.data.projectId, parsed.data.expected);
    const store = appStore({ client, plane: 'owner' });
    const revisions = await store.listRevisions(person.id, parsed.data.projectId);
    const base =
      parsed.data.kind === 'revise'
        ? revisions.find((row) => row.revision === (parsed.data.baseRevision ?? revisions[0]?.revision))
        : null;
    if (parsed.data.kind === 'revise' && !base)
      throw new IntelligenceError('A saved application revision is required before requesting a change.', 409);
    const direction = await readRetainedDirection(parsed.data.projectId).catch(() => null);
    const generated = await generateAppProposal(
      {
        instruction: parsed.data.instruction,
        kind: parsed.data.kind,
        demo: parsed.data.demo,
        baseFiles: base?.files ?? [],
        collections: base?.collections ?? [],
        brief: project.content.blueprint?.vision,
        direction: direction
          ? {
              schema: direction.receipt.schema,
              name: direction.receipt.content.name,
              summary: direction.receipt.content.summary,
              digest: direction.digest,
              verified: direction.verified,
              sourceKind: direction.source_kind,
              colors: direction.receipt.content.colors,
              typography: direction.receipt.content.typography,
              layout: direction.receipt.content.layout,
              copy: direction.receipt.content.copy,
              assets: direction.receipt.content.assets,
            }
          : null,
      },
      transport ?? defaultAppGenerationTransport(),
    );
    const files = generated.proposal.operations
      ? applyFileOperations(base?.files ?? overlaySealedFiles(generated.proposal.files), generated.proposal.operations).files
      : overlaySealedFiles(generated.proposal.files);
    if (base) assertAdditiveSchema(base.collections, generated.proposal.collections);
    const scoped = scopeHash({
      files,
      collections: generated.proposal.collections,
      behaviors: generated.proposal.behaviors,
    });
    return {
      proposal: { ...generated.proposal, files: scoped.files.filter((file) => file.path.startsWith('src/')) },
      treeHash: scoped.treeHash,
      approvalHash: scoped.approvalHash,
      changes: diffAppFiles(base?.files ?? [], scoped.files),
      generation: appGenerationProvenance(generated.mode),
      baseRevision: base?.revision ?? null,
    };
  } catch (error) {
    asIntelligence(error);
  }
}

export async function approveArchitectApp(input: unknown) {
  requireReady();
  const parsed = approveAppCommand.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the application approval fields.', 400);
  try {
    const { person, project, client } = await requireOwnedProject(parsed.data.projectId, parsed.data.expected);
    const store = appStore({ client, plane: 'owner' });
    const revisions = await store.listRevisions(person.id, parsed.data.projectId);
    const base = parsed.data.baseRevision
      ? revisions.find((row) => row.revision === parsed.data.baseRevision)
      : null;
    if (parsed.data.baseRevision && !base)
      throw new IntelligenceError('Stale parent revision. Reload before approving this change.', 409);
    if (base) assertAdditiveSchema(base.collections, parsed.data.proposal.collections);
    const files = parsed.data.proposal.operations
      ? applyFileOperations(base?.files ?? overlaySealedFiles(parsed.data.proposal.files), parsed.data.proposal.operations).files
      : overlaySealedFiles(parsed.data.proposal.files);
    const scoped = scopeHash({
      files,
      collections: parsed.data.proposal.collections,
      behaviors: parsed.data.proposal.behaviors,
    });
    if (scoped.approvalHash !== parsed.data.approvalHash)
      throw new IntelligenceError('Approval no longer matches the reviewed application files.', 409);
    return await store.approveRevision({
      requestId: parsed.data.requestId,
      personId: person.id,
      projectId: parsed.data.projectId,
      name: project.content.name || 'Generated application',
      parentRevision: parsed.data.baseRevision,
      treeHash: scoped.treeHash,
      approvalHash: scoped.approvalHash,
      files: scoped.files,
      collections: parsed.data.proposal.collections,
      behaviors: parsed.data.proposal.behaviors,
      generation: parsed.data.generation,
    });
  } catch (error) {
    asIntelligence(error);
  }
}

export async function startArchitectApp(input: unknown) {
  requireReady();
  const parsed = startAppCommand.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the application start fields.', 400);
  try {
    const { person, client } = await requireOwnedProject(parsed.data.projectId, parsed.data.expected);
    const store = appStore({ client, plane: 'owner' });
    const revision = await store.readRevision(person.id, parsed.data.revisionId);
    if (!revision || revision.project_id !== parsed.data.projectId)
      throw new IntelligenceError('Approved application revision unavailable.', 404);
    if (revision.approval_hash !== parsed.data.approvalHash)
      throw new IntelligenceError('Start no longer matches the reviewed approval.', 409);
    if (revision.status !== 'approved' && revision.status !== 'failed' && revision.status !== 'building')
      throw new IntelligenceError('This revision is not waiting for an explicit start.', 409);
    const app = await store.readApp(person.id, parsed.data.projectId);
    if (!app) throw new IntelligenceError('Application unavailable.', 404);
    return await store.startJob({
      requestId: parsed.data.requestId,
      personId: person.id,
      projectId: parsed.data.projectId,
      appId: app.id,
      revisionId: revision.id,
      approvalHash: revision.approval_hash,
    });
  } catch (error) {
    asIntelligence(error);
  }
}

export async function cancelArchitectApp(input: unknown) {
  requireReady();
  const parsed = cancelAppCommand.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the application cancel fields.', 400);
  try {
    const { person, client } = await requireOwnedProject(parsed.data.projectId);
    return await appStore({ client, plane: 'owner' }).cancelJob(person.id, parsed.data.jobId);
  } catch (error) {
    asIntelligence(error);
  }
}

export async function reopenArchitectApp(input: unknown) {
  requireReady();
  const parsed = reopenAppCommand.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the application reopen fields.', 400);
  try {
    const { person, client } = await requireOwnedProject(parsed.data.projectId);
    const store = appStore({ client, plane: 'owner' });
    const revisions = await store.listRevisions(person.id, parsed.data.projectId);
    const revision = revisions.find((row) => row.revision === parsed.data.revision);
    if (!revision || !revision.working)
      throw new IntelligenceError('Only a saved working application can be reopened.', 409);
    const artifact = await store.readArtifact(person.id, revision.id);
    if (!artifact) throw new IntelligenceError('Compiled artifacts for that revision are unavailable.', 404);
    const sessions = previewStoreFor(client);
    const session = await signPreviewSession({
      personId: person.id,
      projectId: parsed.data.projectId,
      revisionId: revision.id,
      replace: true,
      store: sessions,
    });
    return {
      revision,
      preview: assemblePreviewDocument({
        artifacts: artifact.files,
        session,
        parentOrigin: '*',
        title: revision.generation.notes,
        revision: revision.revision,
        revisionId: revision.id,
        generation: await previewSessionGeneration(revision.id, sessions),
      }),
      session,
      selectedRevision: revision.revision,
    };
  } catch (error) {
    asIntelligence(error);
  }
}

export async function operateArchitectAppData(input: {
  projectId: string;
  revisionId: string;
  session: string;
  requestId: string;
  operation: 'list' | 'get' | 'create' | 'update';
  collection: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  expectedVersion?: number;
}) {
  requireReady();
  try {
    const { person, client } = await requireOwnedProject(input.projectId);
    if (
      !(await verifyPreviewSession(
        input.session,
        { personId: person.id, projectId: input.projectId, revisionId: input.revisionId },
        process.env.ARCHITECT_APPS_PREVIEW_SECRET,
        previewStoreFor(client),
      ))
    )
      throw new IntelligenceError('Preview session is expired, revoked, or not bound to this application revision.', 403);
    assertDataRate(person.id);
    const store = appStore({ client, plane: 'owner' });
    const revision = await store.readRevision(person.id, input.revisionId);
    const app = await store.readApp(person.id, input.projectId);
    if (!revision || !app) throw new IntelligenceError('Application unavailable.', 404);
    if (!revisionAllowsPreview(revision))
      throw new IntelligenceError('Preview data is authorized only for a ready or last-working revision.', 403);
    const schema = revision.collections.find((row) => row.name === input.collection);
    if (!schema) throw new IntelligenceError('Unknown host collection.', 404);
    if (input.operation === 'list') {
      return { requestId: input.requestId, ok: true, records: (await store.listRecords(person.id, app.id, schema.name)).map(recordToItem) };
    }
    if (input.operation === 'get') {
      const id = typeof input.payload?.id === 'string' ? input.payload.id : '';
      const record = id ? await store.readRecord(person.id, app.id, schema.name, id) : null;
      return { requestId: input.requestId, ok: true, records: record ? [recordToItem(record)] : [] };
    }
    if (!input.payload) throw new IntelligenceError('Record payload required.', 400);
    const previous =
      typeof input.payload.id === 'string'
        ? (await store.readRecord(person.id, app.id, schema.name, input.payload.id))?.payload
        : undefined;
    const payload = validateCollectionPayload(schema, input.payload, previous);
    const saved = await store.writeRecord({
      personId: person.id,
      projectId: input.projectId,
      appId: app.id,
      collection: schema.name,
      payload,
      idempotencyKey: input.idempotencyKey,
      id: typeof input.payload.id === 'string' ? input.payload.id : undefined,
      expectedVersion: input.expectedVersion ?? (typeof input.payload.version === 'number' ? input.payload.version : undefined),
    });
    return { requestId: input.requestId, ok: true, records: [recordToItem(saved)] };
  } catch (error) {
    asIntelligence(error);
  }
}
