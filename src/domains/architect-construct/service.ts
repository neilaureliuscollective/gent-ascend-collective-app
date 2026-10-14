import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { approvalHash, labeledSource, treeHash } from './hash';
import { fixtureScope, importedFixtureSource } from './fixture';
import { constructReady } from './readiness';
import { acceptanceChecksFromPlan, persistableCheckPlan, planCheckCoverage } from './check-coverage';
import { validateExistingFilePatches } from './patch-contract';
import { effectiveProtectedPaths } from './path-protection';
import {
  type ConstructBrief,
  type ConstructEvent,
  type SourceSnapshot,
  approveChangeCommand,
  briefScopeSchema,
  cancelCommand,
  defaultLimits,
  proposeCommand,
  startCommand,
  startFixtureCommand,
} from './schema';
import { constructProviderStatus, proposeConstructChange } from './provider';
import { DatabaseConstructStore, memoryConstructStoreAllowed, type ConstructPersistenceClient } from './database-store';
import { ConstructStoreError, type ConstructStore, MemoryConstructStore } from './store';
import { verifyConstructGitPin } from './connections-source';

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
    proposal: constructProviderStatus(),
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
    if (brief.approval_hash !== input.approvalHash)
      throw new IntelligenceError('Approval digest does not match the reviewed brief.', 409);
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

export async function approveConstructChange(input: ReturnType<typeof approveChangeCommand.parse>) {
  requireReady();
  try {
    const { person, project, client } = await requireOwnedProject(input.projectId, input.expected);
    if (input.sourceKind === 'git' && (!input.repository || !input.commit))
      throw new IntelligenceError('Git pins require the selected repository and an exact commit.', 409);
    const store = constructStore({ client, plane: 'owner' });
    const kind = input.sourceKind;
    let repository = input.repository;
    let commit = input.commit;
    let files = input.files;
    let modified = false;
    if (kind === 'git') {
      const verified = await verifyConstructGitPin({
        repository,
        commit: commit!,
        files,
      });
      repository = verified.repository;
      commit = verified.commit;
      files = verified.files;
    } else if (repository && commit) {
      try {
        const verified = await verifyConstructGitPin({ repository, commit, files });
        if (treeHash(files) !== treeHash(verified.files)) modified = true;
      } catch {
        /* Imported files stay owner-supplied when a pin cannot be verified. */
      }
    }
    const protectedPaths = effectiveProtectedPaths(input.protectedPaths);
    const validated = validateExistingFilePatches({
      files,
      patch: input.patch,
      allowedPaths: input.allowedPaths,
      protectedPaths,
      editablePaths: files.map((file) => file.path),
    });
    if (!validated.ok) throw new IntelligenceError(`${validated.message} ${validated.actionable}`, 409);
    const coverage = planCheckCoverage(files);
    const source = await store.importSource({
      id: input.sourceId,
      person_id: person.id,
      kind,
      repository,
      commit,
      label: labeledSource(kind, repository, commit, { modified }),
      tree_hash: treeHash(files),
      files,
      created_at: new Date().toISOString(),
    });
    const scope = briefScopeSchema.parse({
      project_id: project.id,
      project_revision: project.revision,
      source_id: source.id,
      repository,
      source_commit: commit,
      source_tree_hash: source.tree_hash,
      allowed_paths: input.allowedPaths,
      protected_paths: protectedPaths,
      intended_change: input.intendedChange,
      acceptance_checks: acceptanceChecksFromPlan(coverage),
      check_plan: persistableCheckPlan(coverage),
      resource_limits: defaultLimits,
      patch: validated.patch,
    });
    await store.invalidateProjectBriefs(
      person.id,
      project.id,
      'A new approved change replaced earlier execution approval for this project revision.',
    );
    const brief = await store.approveBrief(person.id, input.briefId, scope);
    return { source, brief };
  } catch (error) {
    asIntelligence(error);
  }
}

export async function proposeConstruct(input: ReturnType<typeof proposeCommand.parse>, signal: AbortSignal) {
  requireReady();
  try {
    await requireOwnedProject(input.projectId);
    const proposal = await proposeConstructChange(
      input.instruction,
      {
        allowed_paths: input.allowedPaths,
        protected_paths: effectiveProtectedPaths(input.protectedPaths),
        intended_change: input.intendedChange,
      },
      input.excerpts,
      signal,
    );
    return {
      mocked: constructProviderStatus().mode === 'mock',
      proposal: {
        summary: proposal.summary,
        patch: proposal.patch,
        notes: proposal.notes,
      },
      context: proposal.context,
      coverage: persistableCheckPlan(planCheckCoverage(input.excerpts)),
    };
  } catch (error) {
    asIntelligence(error);
  }
}
