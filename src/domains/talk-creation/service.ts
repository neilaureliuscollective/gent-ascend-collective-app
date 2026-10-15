import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { bucket, verifyStudioProject } from '@/domains/studio/service';
import {
  maxReferenceBytes,
  referenceExtension,
  referenceType,
  type ReferenceType,
} from '@/domains/studio/image-validation';
import { proposeImage, reviewArtifact, readArtifacts } from '@/domains/artifacts/service';
import { canEditArtifact } from '@/domains/artifacts/contract';
import { supabaseConnection } from '@/platform/supabase/connection';
import {
  contentForKind,
  handoffContentSchema,
  handoffInput,
  importOriginInput,
  matchesFrozenHandoff,
  saveCreationInput,
  selectCreationInput,
  transferDirectionInput,
  type BriefContent,
  type CreationKind,
  type HandoffContent,
  type PaletteContent,
  type PlanContent,
  type TalkCreation,
  type TalkCreationWorkspace,
  type TalkImageJob,
} from './schema';
import { matchesHandoffDestination, persistKind } from './persist';
import { designBoardContentSchema, selectedDirection } from './design-board';
import {
  directionProjectIdentity,
  produceArchitectDirection,
} from './architect-direction';
import { receiveDesignDirection } from '@/domains/architect-design-direction/receiver';
import '@/domains/talk-creation/architect-source';
import {
  assertOneSelectionPerKind,
  describeHandoffTransfer,
  originImportMappingVersion,
  originImportNote,
  overlayHandoffImport,
  projectFromResolvedHandoff,
  uniqueKindSelectionMessage,
  type ResolvedArchitectPackage,
} from './origin-import';
import { withCalculatedContrast } from './contrast';
import { originReady } from '@/domains/architect-origin/service';
import { projectContentSchema, type ProjectContent } from '@/domains/architect-origin/schema';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';

async function importedContentMatches(
  client: SupabaseClient<Database>,
  personId: string,
  receipt: { project_id: string; save_id?: string | null },
  expected: ProjectContent,
) {
  const verified = await client
    .from('architect_origin_versions')
    .select('id,project_id,content,note')
    .eq('id', receipt.save_id ?? '')
    .eq('project_id', receipt.project_id)
    .eq('person_id', personId)
    .maybeSingle();
  const stored = verified.data ? projectContentSchema.safeParse(verified.data.content) : null;
  return (
    Boolean(verified.data) &&
    verified.data?.note === originImportNote &&
    Boolean(stored?.success) &&
    JSON.stringify(stored?.success ? stored.data : null) === JSON.stringify(expected)
  );
}

const talkProjectTitle = 'Talk references';

function asCreation(row: {
  id: string;
  person_id: string;
  conversation_id: string;
  source_turn_id: string | null;
  lineage_id: string;
  version: number;
  kind: string;
  content: unknown;
  predecessor_id: string | null;
  superseded_by: string | null;
  candidate?: boolean;
  created_at: string;
}): TalkCreation | null {
  try {
    return {
      ...row,
      kind: row.kind as CreationKind,
      candidate: Boolean(row.candidate),
      content: contentForKind(row.kind as CreationKind, row.content),
    };
  } catch {
    return null;
  }
}

export async function readTalkCreations(conversationId: string): Promise<TalkCreationWorkspace> {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const conversation = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .maybeSingle();
  if (conversation.error || !conversation.data)
    throw new IntelligenceError('Conversation unavailable.', 404);
  const [rows, selected, images, attachment, imports] = await Promise.all([
    client
      .from('ai_talk_creations')
      .select('*')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId)
      .is('superseded_by', null)
      .order('created_at', { ascending: false })
      .limit(48),
    client
      .from('ai_talk_selection')
      .select('kind,creation_id')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId),
    readArtifacts(conversationId).catch(() => null),
    talkAttachmentProject(false).catch(() => null),
    client
      .from('ai_talk_origin_imports')
      .select('handoff_id,project_id,save_id')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId),
  ]);
  if (rows.error || selected.error)
    throw new IntelligenceError('Saved Talk work could not be loaded.', 503);
  const imported = new Map(
    (imports.error ? [] : (imports.data ?? []))
      .filter((row) => matchesHandoffDestination(person.id, row.handoff_id, row))
      .map((row) => [row.handoff_id, row.project_id] as const),
  );
  const creations = (rows.data ?? [])
    .map(asCreation)
    .filter((item): item is TalkCreation => !!item)
    .map((item) => overlayHandoffImport(item, imported.get(item.id)));
  const selection: TalkCreationWorkspace['selected'] = {};
  for (const row of selected.data ?? []) {
    if (row.kind === 'brief' || row.kind === 'plan' || row.kind === 'palette' || row.kind === 'board')
      selection[row.kind] = row.creation_id;
  }
  const imageJobs: TalkImageJob[] = (images?.artifacts ?? [])
    .filter(
      (item): item is typeof item & { operation: 'image.create' | 'image.edit' } =>
        item.operation === 'image.create' || item.operation === 'image.edit',
    )
    .map((item) => ({
      id: item.id,
      conversation_id: item.conversation_id,
      operation: item.operation,
      prompt: item.prompt,
      status: item.status,
      project_id: item.project_id,
      version_id: item.version_id,
      base_version_id: item.base_version_id,
      preview_index: item.preview_index,
      created_at: item.created_at,
    }));
  const access = await currentAccess();
  return {
    creations,
    selected: selection,
    images: imageJobs,
    selectedImageId: images?.selectedId ?? null,
    canCreateImages: access.has('studio.create'),
    imageAccess: access.has('studio.create') && Boolean(process.env.OPENAI_API_KEY)
      ? 'ready'
      : 'unavailable',
    attachmentProjectId: attachment,
  };
}

export async function saveTalkCreation(input: unknown) {
  const parsed = saveCreationInput.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the brief, plan or palette.');
  const { client } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  try {
    const saved = await persistKind(client, {
      id: parsed.data.id,
      conversationId: parsed.data.conversationId,
      sourceTurnId: parsed.data.sourceTurnId ?? null,
      kind: parsed.data.kind,
      predecessorId: parsed.data.predecessorId,
      content: parsed.data.content,
    });
    return saved;
  } catch (error) {
    throw new IntelligenceError(
      error instanceof Error && error.message === 'Stale creation version'
        ? 'This version changed. Reload the saved work before editing again.'
        : error instanceof Error && /reused with different inputs/i.test(error.message)
          ? 'This save request was already used with different content. Start a new edit.'
          : 'This work could not be saved.',
      error instanceof Error &&
        (error.message === 'Stale creation version' ||
          /reused with different inputs/i.test(error.message))
        ? 409
        : 503,
    );
  }
}

export async function selectTalkCreation(input: unknown) {
  const parsed = selectCreationInput.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Choose saved work to keep.');
  const { client } = await intelligenceSession();
  const result = await client.rpc('ai_talk_select_creation', {
    p_conversation: parsed.data.conversationId,
    p_creation: parsed.data.creationId,
  });
  if (result.error || !result.data)
    throw new IntelligenceError('This version could not be selected.', 409);
}

export async function readCreationLineage(lineageId: string) {
  const { client, person } = await intelligenceSession();
  const rows = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('person_id', person.id)
    .eq('lineage_id', lineageId)
    .order('version', { ascending: true })
    .limit(40);
  if (rows.error) throw new IntelligenceError('Version history could not be loaded.', 503);
  return (rows.data ?? []).map(asCreation).filter((item): item is TalkCreation => !!item);
}

export async function proposeTalkImage(input: unknown) {
  return proposeImage(input, undefined, 'talk');
}

export async function reviewTalkImage(id: string, approve: boolean) {
  return reviewArtifact(id, approve, 'talk');
}

export async function prepareArchitectHandoff(input: unknown) {
  const parsed = handoffInput.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Review the Architect package before saving.');
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const existing = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', parsed.data.id)
    .eq('person_id', person.id)
    .eq('conversation_id', parsed.data.conversationId)
    .eq('kind', 'handoff')
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('The Architect package could not be saved.', 503);
  if (existing.data) {
    const creation = asCreation(existing.data);
    const content =
      creation?.kind === 'handoff' && 'imported' in creation.content ? creation.content : null;
    if (!content || !matchesFrozenHandoff(content, parsed.data))
      throw new IntelligenceError(
        'This save request was already used with different content. Start a new edit.',
        409,
      );
    const receipt = await client
      .from('ai_talk_origin_imports')
      .select('project_id,save_id')
      .eq('person_id', person.id)
      .eq('handoff_id', existing.data.id)
      .maybeSingle();
    const imported =
      !receipt.error &&
      Boolean(receipt.data?.project_id) &&
      matchesHandoffDestination(person.id, existing.data.id, receipt.data);
    return {
      id: existing.data.id,
      lineageId: existing.data.lineage_id,
      version: existing.data.version,
      content: imported && receipt.data
        ? { ...content, imported: true, originProjectId: receipt.data.project_id }
        : content,
      recovered: true,
      imported,
      projectId: receipt.data?.project_id ?? null,
    };
  }
  const workspace = await readTalkCreations(parsed.data.conversationId);
  const requested = parsed.data.creationIds.map((id) => {
    const creation = workspace.creations.find((item) => item.id === id);
    if (!creation || creation.kind === 'handoff' || creation.superseded_by || creation.candidate)
      throw new IntelligenceError('Choose current brief, plan or palette versions.', 409);
    return creation;
  });
  const boards = requested.filter((item) => item.kind === 'board');
  const text = requested.filter(
    (item) => item.kind === 'brief' || item.kind === 'plan' || item.kind === 'palette',
  );
  if (boards.length && !text.length)
    throw new IntelligenceError(
      'Design boards use the Architect design-direction transfer, not v1 text import.',
      409,
    );
  if (boards.length)
    throw new IntelligenceError(
      'v1 Architect text import cannot include a design board. Transfer the board separately or omit it.',
      409,
    );
  const selections = text.map((creation) => ({
    kind: creation.kind as 'brief' | 'plan' | 'palette',
    lineageId: creation.lineage_id,
    versionId: creation.id,
    version: creation.version,
    title: 'title' in creation.content ? creation.content.title : creation.kind,
  }));
  try {
    assertOneSelectionPerKind(selections);
  } catch (error) {
    if (error instanceof Error && error.message === uniqueKindSelectionMessage)
      throw new IntelligenceError(uniqueKindSelectionMessage, 409);
    throw error;
  }
  const images = parsed.data.imageIds.map((id) => {
    const image = workspace.images.find((item) => item.id === id);
    if (!image || image.status !== 'complete' || !image.version_id || !image.project_id)
      throw new IntelligenceError('Only completed saved images can enter the Architect package.', 409);
    return {
      artifactId: image.id,
      versionId: image.version_id,
      projectId: image.project_id,
      prompt: image.prompt.slice(0, 300),
    };
  });
  const content: HandoffContent = handoffContentSchema.parse({
    schema: 'talk-architect-handoff/v1',
    conversationId: parsed.data.conversationId,
    preparedAt: parsed.data.preparedAt ?? new Date().toISOString(),
    discipline: parsed.data.discipline,
    idea: parsed.data.idea,
    description: parsed.data.description,
    decisions: parsed.data.decisions,
    selections,
    images,
    imported: false,
  });
  const saved = await saveTalkCreation({
    id: parsed.data.id,
    conversationId: parsed.data.conversationId,
    kind: 'handoff',
    predecessorId: null,
    content,
  });
  return { ...saved, content, imported: false as const, projectId: null };
}

async function resolveArchitectPackage(
  handoffRow: TalkCreation,
): Promise<ResolvedArchitectPackage> {
  if (handoffRow.kind !== 'handoff' || !('imported' in handoffRow.content))
    throw new IntelligenceError('This Architect package is unavailable.', 404);
  const { client, person } = await intelligenceSession();
  const handoff = handoffRow.content;
  const selections = await Promise.all(
    handoff.selections.map(async (selection) => {
      const row = await client
        .from('ai_talk_creations')
        .select('*')
        .eq('id', selection.versionId)
        .eq('person_id', person.id)
        .eq('conversation_id', handoff.conversationId)
        .maybeSingle();
      const creation = row.data ? asCreation(row.data) : null;
      if (
        !creation ||
        creation.kind === 'handoff' ||
        creation.candidate ||
        creation.kind !== selection.kind ||
        creation.lineage_id !== selection.lineageId ||
        creation.version !== selection.version
      )
        throw new IntelligenceError(
          'A selected brief, plan or palette in this package is no longer available.',
          409,
        );
      return {
        kind: creation.kind,
        lineageId: creation.lineage_id,
        versionId: creation.id,
        version: creation.version,
        title: 'title' in creation.content ? creation.content.title : creation.kind,
        content: creation.content as BriefContent | PlanContent | PaletteContent,
      };
    }),
  );
  const artifacts = await readArtifacts(handoff.conversationId).catch(() => null);
  const images = handoff.images.map((image) => {
    const artifact = artifacts?.artifacts.find((item) => item.id === image.artifactId);
    if (
      !artifact ||
      artifact.status !== 'complete' ||
      artifact.version_id !== image.versionId ||
      artifact.project_id !== image.projectId
    )
      throw new IntelligenceError('A selected image in this package is no longer available.', 409);
    return {
      artifactId: image.artifactId,
      versionId: image.versionId,
      projectId: image.projectId,
      prompt: image.prompt,
    };
  });
  try {
    assertOneSelectionPerKind(selections);
  } catch (error) {
    if (error instanceof Error && error.message === uniqueKindSelectionMessage)
      throw new IntelligenceError(uniqueKindSelectionMessage, 409);
    throw error;
  }
  return {
    handoff,
    sourceTurnId: handoffRow.source_turn_id,
    brief: selections.find((item) => item.kind === 'brief')?.content as BriefContent | undefined,
    plan: selections.find((item) => item.kind === 'plan')?.content as PlanContent | undefined,
    palette: selections.find((item) => item.kind === 'palette')?.content as PaletteContent | undefined,
    selections,
    images,
  };
}

export async function reviewArchitectImport(handoffId: string) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const row = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', handoffId)
    .eq('person_id', person.id)
    .eq('kind', 'handoff')
    .maybeSingle();
  if (row.error) throw new IntelligenceError('The Architect package could not be reviewed.', 503);
  const creation = row.data ? asCreation(row.data) : null;
  if (!creation) throw new IntelligenceError('Architect package unavailable.', 404);
  const resolved = await resolveArchitectPackage(creation);
  const receipt = await client
    .from('ai_talk_origin_imports')
    .select('project_id,save_id,provenance')
    .eq('person_id', person.id)
    .eq('handoff_id', handoffId)
    .maybeSingle();
  const acknowledged =
    Boolean(receipt.data?.project_id) &&
    matchesHandoffDestination(person.id, handoffId, receipt.data);
  const transfer = describeHandoffTransfer(resolved);
  return {
    handoffId,
    conversationId: resolved.handoff.conversationId,
    preparedAt: resolved.handoff.preparedAt,
    sourceTurnId: resolved.sourceTurnId,
    imported: acknowledged,
    projectId: acknowledged ? receipt.data?.project_id ?? null : null,
    saveId: acknowledged ? receipt.data?.save_id ?? null : null,
    originReady: originReady(),
    mappingVersion: originImportMappingVersion,
    project: projectFromResolvedHandoff(resolved),
    transfer,
    selections: resolved.selections.map((item) => ({
      kind: item.kind,
      lineageId: item.lineageId,
      versionId: item.versionId,
      version: item.version,
      title: item.title,
    })),
    images: resolved.images,
  };
}

export async function importArchitectHandoff(input: unknown) {
  const parsed = importOriginInput.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Confirm the Architect package before importing.');
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  if (!originReady())
    throw new IntelligenceError(
      'Architect persistence is unavailable. The package stays prepared and was not imported.',
      503,
    );
  const existing = await client
    .from('ai_talk_origin_imports')
    .select('*')
    .eq('id', parsed.data.id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('The Architect import receipt could not be read.', 503);
  if (existing.data) {
    if (
      existing.data.handoff_id !== parsed.data.handoffId ||
      existing.data.conversation_id !== parsed.data.conversationId ||
      !matchesHandoffDestination(person.id, existing.data.handoff_id, existing.data)
    )
      throw new IntelligenceError(
        'This import request was already used with a different package.',
        409,
      );
    const reviewed = await reviewArchitectImport(existing.data.handoff_id);
    if (!(await importedContentMatches(client, person.id, existing.data, reviewed.project)))
      throw new IntelligenceError(
        'This Architect project already exists with different content. The Talk package was not imported.',
        409,
      );
    return {
      id: existing.data.id,
      handoffId: existing.data.handoff_id,
      projectId: existing.data.project_id,
      saveId: existing.data.save_id,
      imported: true as const,
      recovered: true,
      mappingVersion: originImportMappingVersion,
      project: reviewed.project,
      transfer: reviewed.transfer,
    };
  }
  const prior = await client
    .from('ai_talk_origin_imports')
    .select('*')
    .eq('person_id', person.id)
    .eq('handoff_id', parsed.data.handoffId)
    .maybeSingle();
  if (prior.error) throw new IntelligenceError('The Architect import receipt could not be read.', 503);
  if (prior.data) {
    if (
      prior.data.conversation_id !== parsed.data.conversationId ||
      !matchesHandoffDestination(person.id, prior.data.handoff_id, prior.data)
    )
      throw new IntelligenceError(
        'This import request was already used with a different package.',
        409,
      );
    const reviewed = await reviewArchitectImport(prior.data.handoff_id);
    if (!(await importedContentMatches(client, person.id, prior.data, reviewed.project)))
      throw new IntelligenceError(
        'This Architect project already exists with different content. The Talk package was not imported.',
        409,
      );
    return {
      id: prior.data.id,
      handoffId: prior.data.handoff_id,
      projectId: prior.data.project_id,
      saveId: prior.data.save_id,
      imported: true as const,
      recovered: true,
      mappingVersion: originImportMappingVersion,
      project: reviewed.project,
      transfer: reviewed.transfer,
    };
  }
  const row = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', parsed.data.handoffId)
    .eq('person_id', person.id)
    .eq('conversation_id', parsed.data.conversationId)
    .eq('kind', 'handoff')
    .maybeSingle();
  if (row.error) throw new IntelligenceError('The Architect package could not be imported.', 503);
  const creation = row.data ? asCreation(row.data) : null;
  if (!creation) throw new IntelligenceError('Architect package unavailable.', 404);
  const resolved = await resolveArchitectPackage(creation);
  if (resolved.handoff.conversationId !== parsed.data.conversationId)
    throw new IntelligenceError('This import request was already used with a different package.', 409);
  const content = projectFromResolvedHandoff(resolved);
  const transfer = describeHandoffTransfer(resolved);
  const recorded = await client.rpc('ai_talk_import_origin', {
    p_id: parsed.data.id,
    p_handoff: parsed.data.handoffId,
    p_conversation: parsed.data.conversationId,
  });
  if (recorded.error || !recorded.data)
    throw new IntelligenceError(
      /reused with different inputs/i.test(recorded.error?.message ?? '')
        ? 'This import request was already used with a different package.'
        : /Project unavailable|Replay mismatch/i.test(recorded.error?.message ?? '')
          ? 'This Architect project already exists with different content. The Talk package was not imported.'
          : /one current brief, plan or palette of each kind/i.test(recorded.error?.message ?? '')
            ? uniqueKindSelectionMessage
            : 'Architect could not save this project. The package stays prepared and was not imported.',
      /reused with different inputs|Project unavailable|Replay mismatch|one current brief, plan or palette of each kind/i.test(
        recorded.error?.message ?? '',
      )
        ? 409
        : 503,
    );
  const receipt = recorded.data as {
    id: string;
    handoffId: string;
    projectId: string;
    saveId?: string;
    mappingVersion?: string;
    recovered?: boolean;
  };
  if (
    !(await importedContentMatches(
      client,
      person.id,
      { project_id: receipt.projectId, save_id: receipt.saveId ?? '' },
      content,
    ))
  )
    throw new IntelligenceError(
      'Architect could not save this project. The package stays prepared and was not imported.',
      503,
    );
  return {
    id: receipt.id,
    handoffId: receipt.handoffId,
    projectId: receipt.projectId,
    saveId: receipt.saveId ?? '',
    imported: true as const,
    recovered: Boolean(receipt.recovered),
    mappingVersion: receipt.mappingVersion ?? originImportMappingVersion,
    project: content,
    transfer,
  };
}

async function authorizedBoard(conversationId: string, boardId: string) {
  const { client, person } = await intelligenceSession();
  const row = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', boardId)
    .eq('person_id', person.id)
    .eq('conversation_id', conversationId)
    .eq('kind', 'board')
    .maybeSingle();
  if (row.error) throw new IntelligenceError('The design board could not be reviewed.', 503);
  const board = row.data ? designBoardContentSchema.safeParse(row.data.content) : null;
  if (!row.data || row.data.candidate || !board?.success)
    throw new IntelligenceError('Design board unavailable.', 404);
  return { person, client, creation: row.data, board: board.data };
}

export async function reviewDesignDirection(boardId: string) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const row = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', boardId)
    .eq('person_id', person.id)
    .eq('kind', 'board')
    .maybeSingle();
  if (row.error) throw new IntelligenceError('The design board could not be reviewed.', 503);
  if (!row.data) throw new IntelligenceError('Design board unavailable.', 404);
  const { creation, board } = await authorizedBoard(row.data.conversation_id, boardId);
  const receipt = produceArchitectDirection({
    conversationId: creation.conversation_id,
    boardId: creation.id,
    version: creation.version,
    board,
  });
  const existing = await client
    .from('ai_talk_direction_transfers')
    .select('id,project_id,digest,imported')
    .eq('person_id', person.id)
    .eq('board_id', creation.id)
    .eq('board_version', creation.version)
    .eq('direction_id', selectedDirection(board).id)
    .maybeSingle();
  const destination = existing.data
    ? await client
        .from('architect_design_directions')
        .select('request_id,project_id,digest,verified')
        .eq('request_id', existing.data.id)
        .eq('person_id', person.id)
        .maybeSingle()
    : { data: null, error: null };
  const destinationOk = Boolean(
    destination.data?.verified &&
      destination.data.digest === receipt.digest &&
      destination.data.project_id === existing.data?.project_id,
  );
  return {
    boardId: creation.id,
    conversationId: creation.conversation_id,
    version: creation.version,
    directionId: selectedDirection(board).id,
    receipt,
    unsupported: [
      'Talk hero-product demonstration stays in Talk. Architect v1 demo is tracker or none.',
      'Typeface names, shape, material, surface/border roles and disclaimer stay in Talk.',
    ],
    requestId: existing.data?.id ?? null,
    imported: Boolean(existing.data?.imported && existing.data.digest === receipt.digest && destinationOk),
    projectId: destinationOk ? existing.data?.project_id ?? null : null,
    destinationValid: destinationOk,
    originReady: originReady(),
    digest: receipt.digest,
    boardVersion: creation.version,
    selectedDirectionId: selectedDirection(board).id,
    selectedDirectionName: selectedDirection(board).name,
  };
}

export async function transferDesignDirection(input: unknown) {
  const parsed = transferDirectionInput.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Confirm the selected design direction before transfer.');
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const { person, client, creation, board } = await authorizedBoard(
    parsed.data.conversationId,
    parsed.data.boardId,
  );
  const receipt = produceArchitectDirection({
    conversationId: creation.conversation_id,
    boardId: creation.id,
    version: creation.version,
    board,
  });
  if (receipt.digest !== parsed.data.reviewedDigest)
    throw new IntelligenceError('This design changed. Review it again before transfer.', 409);
  const projectId = directionProjectIdentity(
    person.id,
    creation.id,
    creation.version,
    selectedDirection(board).id,
  );
  const retained = await receiveDesignDirection({
    action: 'receive',
    requestId: parsed.data.id,
    projectId,
    receipt,
  });
  if (
    retained.digest !== receipt.digest ||
    retained.project_id !== projectId ||
    retained.request_id !== parsed.data.id ||
    !retained.verified
  )
    throw new IntelligenceError(
      'Architect did not acknowledge this exact reviewed design direction.',
      409,
    );
  const existing = await client
    .from('ai_talk_direction_transfers')
    .select('*')
    .eq('id', parsed.data.id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('The design-direction receipt could not be read.', 503);
  if (existing.data) {
    if (
      existing.data.conversation_id !== creation.conversation_id ||
      existing.data.board_id !== creation.id ||
      existing.data.board_version !== creation.version ||
      existing.data.digest !== receipt.digest ||
      existing.data.project_id !== retained.project_id
    )
      throw new IntelligenceError('This transfer request was already used with a different design.', 409);
    return {
      id: existing.data.id,
      projectId: existing.data.project_id,
      digest: existing.data.digest,
      imported: Boolean(existing.data.imported) && retained.verified && retained.digest === receipt.digest,
      recovered: true,
      receipt,
      started: false,
    };
  }
  const recorded = await client.rpc('ai_talk_record_direction_transfer', {
    p_id: parsed.data.id,
    p_conversation: creation.conversation_id,
    p_board: creation.id,
    p_version: creation.version,
    p_direction: selectedDirection(board).id,
    p_direction_uuid: receipt.identity.directionId,
    p_project: retained.project_id,
    p_digest: retained.digest,
    p_receipt: receipt,
  });
  if (recorded.error || !recorded.data)
    throw new IntelligenceError(
      /reused with different inputs/i.test(recorded.error?.message ?? '')
        ? 'This transfer request was already used with a different design.'
        : 'Architect acknowledged the direction but Talk could not retain the receipt. Retry the same request.',
      409,
    );
  const saved = recorded.data as { id: string; projectId: string; digest: string; imported: boolean; recovered?: boolean };
  return {
    id: saved.id,
    projectId: saved.projectId,
    digest: saved.digest,
    imported: Boolean(saved.imported) && retained.verified,
    recovered: Boolean(saved.recovered),
    receipt,
    started: false as const,
  };
}

export async function talkAttachmentProject(create = true) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('aurelius.context'))
    throw new IntelligenceError('Aethelios access is not enabled for this account.', 403);
  const existing = await client
    .from('ai_studio_projects')
    .select('id')
    .eq('person_id', person.id)
    .is('company_id', null)
    .eq('title', talkProjectTitle)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('Attachment project unavailable.', 503);
  if (existing.data?.id) return existing.data.id;
  if (!create) return null;
  const id = crypto.randomUUID();
  const created = await client
    .from('ai_studio_projects')
    .insert({
      id,
      person_id: person.id,
      title: talkProjectTitle,
      creative_type: 'personal',
      brief: {},
    })
    .select('id')
    .single();
  if (created.error || !created.data)
    throw new IntelligenceError('Attachment storage could not be prepared.', 503);
  return created.data.id;
}

export async function prepareTalkAttachment(mediaType: ReferenceType, byteSize: number) {
  if (byteSize < 100 || byteSize > maxReferenceBytes)
    throw new IntelligenceError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.', 422);
  const { client } = await intelligenceSession();
  const projectId = await talkAttachmentProject();
  const auth = await client.auth.getUser();
  if (!auth.data.user) throw new IntelligenceError('Session expired.', 401);
  const id = crypto.randomUUID();
  const key = `${auth.data.user.id}/${projectId}/${id}.${referenceExtension(mediaType)}`;
  const signed = await client.storage.from(bucket).createSignedUploadUrl(key, { upsert: false });
  if (signed.error || !signed.data)
    throw new IntelligenceError('Attachment upload could not be prepared.', 503);
  const connection = supabaseConnection(process.env);
  if (!connection) throw new IntelligenceError('Storage is not configured.', 503);
  return {
    id,
    projectId,
    path: signed.data.path,
    token: signed.data.token,
    url: connection.url,
    publishableKey: connection.key,
  };
}

export async function completeTalkAttachment(
  projectId: string,
  id: string,
  mediaType: ReferenceType,
) {
  const { client, person } = await intelligenceSession();
  const owner = await client
    .from('ai_studio_projects')
    .select('id')
    .eq('id', projectId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .maybeSingle();
  if (owner.error || !owner.data) throw new IntelligenceError('Attachment project unavailable.', 404);
  const existing = await client
    .from('ai_studio_references')
    .select('id,media_type,byte_size')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('Attachment could not be verified.', 503);
  const auth = await client.auth.getUser();
  if (!auth.data.user) throw new IntelligenceError('Session expired.', 401);
  const key = `${auth.data.user.id}/${projectId}/${id}.${referenceExtension(mediaType)}`;
  const stored = await client.storage.from(bucket).download(key);
  if (stored.error || !stored.data)
    throw new IntelligenceError('Upload did not finish. Try selecting the image again.', 409);
  const bytes = new Uint8Array(await stored.data.arrayBuffer());
  if (referenceType(bytes) !== mediaType) {
    // Validation failure leaves the asset untouched; no deletion.
    throw new IntelligenceError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.', 422);
  }
  if (existing.data) {
    if (existing.data.media_type !== mediaType || existing.data.byte_size !== bytes.length)
      throw new IntelligenceError('The stored attachment changed. Choose the image again.', 409);
    return { id, projectId };
  }
  const record = await client.from('ai_studio_references').insert({
    id,
    person_id: person.id,
    project_id: projectId,
    storage_key: key,
    media_type: mediaType,
    byte_size: bytes.length,
  });
  if (record.error) {
    const check = await client
      .from('ai_studio_references')
      .select('id')
      .eq('id', id)
      .eq('person_id', person.id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (check.data) return { id, projectId };
    throw new IntelligenceError('Attachment could not be saved.', 503);
  }
  return { id, projectId };
}

export async function readTalkAttachment(id: string) {
  const { client, person } = await intelligenceSession();
  const row = await client
    .from('ai_studio_references')
    .select('id,project_id,storage_key,media_type,byte_size')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (row.error) throw new IntelligenceError('Attachment could not be verified.', 503);
  if (!row.data) throw new IntelligenceError('Attachment unavailable.', 404);
  await verifyStudioProject(row.data.project_id);
  const stored = await client.storage.from(bucket).download(row.data.storage_key);
  if (stored.error || !stored.data) throw new IntelligenceError('Attachment unavailable.', 404);
  const bytes = new Uint8Array(await stored.data.arrayBuffer());
  const type = referenceType(bytes);
  if (!type || type !== row.data.media_type)
    throw new IntelligenceError('Attachment is not a supported image.', 422);
  return { id: row.data.id, projectId: row.data.project_id, mediaType: type, bytes };
}

export function exportCreationText(creation: TalkCreation) {
  if (creation.kind === 'palette') {
    const palette = withCalculatedContrast(contentForKind('palette', creation.content));
    return [
      palette.title,
      palette.notes,
      ...palette.swatches.map((swatch) => `${swatch.name} ${swatch.hex} (${swatch.role})`),
      ...palette.contrast.map(
        (pair) => `${pair.pair}: ${pair.ratio}:1${pair.passesAa ? ' AA' : ''}`,
      ),
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (creation.kind === 'plan') {
    const plan = contentForKind('plan', creation.content);
    return [
      plan.title,
      plan.summary,
      ...plan.steps.map(
        (step, index) =>
          `${index + 1}. ${step.title}${step.dependsOn.length ? ` (after ${step.dependsOn.join(', ')})` : ''}\n${step.detail}`,
      ),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  if (creation.kind === 'brief') {
    const brief = contentForKind('brief', creation.content);
    return [
      brief.title,
      `Purpose: ${brief.purpose}`,
      `Audience: ${brief.audience}`,
      `Visual direction: ${brief.visualDirection}`,
      brief.requirements.length ? `Requirements:\n- ${brief.requirements.join('\n- ')}` : '',
      brief.unresolved.length ? `Unresolved:\n- ${brief.unresolved.join('\n- ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  return JSON.stringify(creation.content, null, 2);
}

export { canEditArtifact };
