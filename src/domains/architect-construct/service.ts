import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { approvalHash } from './hash';
import { fixtureScope, importedFixtureSource } from './fixture';
import { constructReady } from './readiness';
import {
  type ConstructBrief,
  type ConstructEvent,
  type SourceSnapshot,
  cancelCommand,
  startCommand,
  startFixtureCommand,
} from './schema';
import { DatabaseConstructStore, memoryConstructStoreAllowed, type ConstructPersistenceClient } from './database-store';
import { ConstructStoreError, type ConstructStore, MemoryConstructStore } from './store';

let memory: MemoryConstructStore | null = null;

export function constructStore(options?: {
  client?: ConstructPersistenceClient;
  plane?: 'owner' | 'worker';
}): ConstructStore {
  if (memoryConstructStoreAllowed()) {
    memory ??= new MemoryConstructStore();
    return memory;
  }
  if (!options?.client)
    throw new ConstructStoreError(
      'Database-backed Construct store is required. The labelled memory store is test/development only.',
      'unavailable',
    );
  return new DatabaseConstructStore(options.client, options.plane ?? 'owner');
}

function requireReady() {
  if (!constructReady())
    throw new IntelligenceError(
      'Architect execution is awaiting its reviewed database migration and local worker enablement. Origin editing remains available.',
      503,
    );
}

function asIntelligence(error: unknown): never {
  if (error instanceof IntelligenceError) throw error;
  if (error instanceof ConstructStoreError)
    throw new IntelligenceError(
      error.message,
      error.code === 'not_found' ? 404 : 409,
    );
  throw new IntelligenceError(
    error instanceof Error ? error.message : 'Construct request could not be completed.',
    503,
  );
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
  if (owned.data.content.status === 'archived')
    throw new IntelligenceError('Archived projects cannot start execution.', 409);
  if (expected !== undefined && owned.data.revision !== expected)
    throw new IntelligenceError(
      'Project revision changed. The previous execution approval is invalid. Reload and pin a new brief.',
      409,
    );
  return { person, project: owned.data, client: client as unknown as ConstructPersistenceClient };
}

export async function readConstruct(projectId: string) {
  requireReady();
  const { person, project, client } = await requireOwnedProject(projectId);
  const store = constructStore({ client, plane: 'owner' });
  const runs = await store.listRuns(person.id, projectId);
  const events: Record<string, ConstructEvent[]> = {};
  const briefs: ConstructBrief[] = [];
  const sources: SourceSnapshot[] = [];
  for (const run of runs) {
    events[run.id] = await store.listEvents(person.id, run.id);
    const brief = await store.readBrief(person.id, run.brief_id);
    if (brief && !briefs.some((row) => row.id === brief.id)) briefs.push(brief);
    const source = await store.readSource(person.id, run.source_id);
    if (source && !sources.some((row) => row.id === source.id)) sources.push(source);
  }
  return {
    project: { id: project.id, revision: project.revision, name: project.content.name },
    runs,
    events,
    briefs,
    sources,
  };
}

export async function startConstruct(input: ReturnType<typeof startCommand.parse>) {
  requireReady();
  try {
    const { person, project, client } = await requireOwnedProject(input.projectId, input.expected);
    const store = constructStore({ client, plane: 'owner' });
    const brief = await store.readBrief(person.id, input.briefId);
    if (!brief) throw new IntelligenceError('Approved brief unavailable.', 404);
    if (brief.status !== 'approved')
      throw new IntelligenceError(
        brief.invalidation_reason || 'This brief was invalidated. Approve a new source-pinned brief.',
        409,
      );
    if (
      brief.scope.project_id !== project.id ||
      brief.scope.project_revision !== project.revision ||
      brief.approval_hash !== approvalHash(brief.scope)
    ) {
      await store.invalidateProjectBriefs(
        person.id,
        project.id,
        'Source base or project revision no longer matches the approved brief.',
      );
      throw new IntelligenceError(
        'Source base or project revision changed. The previous execution approval is invalid.',
        409,
      );
    }
    const source = await store.readSource(person.id, brief.scope.source_id);
    if (!source)
      throw new IntelligenceError(
        'Source snapshot is missing. Missing source is a blocker; Architect will not invent repository files.',
        409,
      );
    if (source.tree_hash !== brief.scope.source_tree_hash) {
      await store.invalidateProjectBriefs(person.id, project.id, 'Imported source tree changed.');
      throw new IntelligenceError('Imported source tree changed. Approve a new brief.', 409);
    }
    return await store.startRun({
      personId: person.id,
      projectId: project.id,
      briefId: brief.id,
      requestId: input.requestId,
      expected: project.revision,
      sourceKind: source.kind,
      sourceTreeHash: source.tree_hash,
      approvalHash: brief.approval_hash,
      sourceId: source.id,
    });
  } catch (error) {
    asIntelligence(error);
  }
}

export async function startFixtureConstruct(input: ReturnType<typeof startFixtureCommand.parse>) {
  requireReady();
  try {
    const { person, project, client } = await requireOwnedProject(input.projectId, input.expected);
    const store = constructStore({ client, plane: 'owner' });
    const source = importedFixtureSource(person.id, input.requestId);
    await store.importSource(source);
    const existing = await store.readRun(person.id, input.requestId);
    if (existing) return existing;
    await store.invalidateProjectBriefs(
      person.id,
      project.id,
      'A new fixture brief replaced earlier execution approval for this project revision.',
    );
    const brief = await store.approveBrief(
      person.id,
      input.requestId,
      fixtureScope({
        projectId: project.id,
        projectRevision: project.revision,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    );
    return await store.startRun({
      personId: person.id,
      projectId: project.id,
      briefId: brief.id,
      requestId: input.requestId,
      expected: project.revision,
      sourceKind: source.kind,
      sourceTreeHash: source.tree_hash,
      approvalHash: brief.approval_hash,
      sourceId: source.id,
    });
  } catch (error) {
    asIntelligence(error);
  }
}

export async function cancelConstruct(input: ReturnType<typeof cancelCommand.parse>) {
  requireReady();
  try {
    const { person, client } = await requireOwnedProject(input.projectId);
    return await constructStore({ client, plane: 'owner' }).cancelRun(person.id, input.runId);
  } catch (error) {
    asIntelligence(error);
  }
}
