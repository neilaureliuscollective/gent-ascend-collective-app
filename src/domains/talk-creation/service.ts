import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { bucket } from '@/domains/studio/service';
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
  matchesFrozenHandoff,
  saveCreationInput,
  selectCreationInput,
  type CreationKind,
  type HandoffContent,
  type TalkCreation,
  type TalkCreationWorkspace,
  type TalkImageJob,
} from './schema';
import { persistKind } from './persist';
import { withCalculatedContrast } from './contrast';

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
  const [rows, selected, images, attachment] = await Promise.all([
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
  ]);
  if (rows.error || selected.error)
    throw new IntelligenceError('Saved Talk work could not be loaded.', 503);
  const creations = (rows.data ?? []).map(asCreation).filter((item): item is TalkCreation => !!item);
  const selection: TalkCreationWorkspace['selected'] = {};
  for (const row of selected.data ?? []) {
    if (row.kind === 'brief' || row.kind === 'plan' || row.kind === 'palette')
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
      creation?.kind === 'handoff' && 'schema' in creation.content ? creation.content : null;
    if (!content || !matchesFrozenHandoff(content, parsed.data))
      throw new IntelligenceError(
        'This save request was already used with different content. Start a new edit.',
        409,
      );
    return {
      id: existing.data.id,
      lineageId: existing.data.lineage_id,
      version: existing.data.version,
      content,
      recovered: true,
      imported: false as const,
    };
  }
  const workspace = await readTalkCreations(parsed.data.conversationId);
  const selections = parsed.data.creationIds.map((id) => {
    const creation = workspace.creations.find((item) => item.id === id);
    if (!creation || creation.kind === 'handoff' || creation.superseded_by || creation.candidate)
      throw new IntelligenceError('Choose current brief, plan or palette versions.', 409);
    return {
      kind: creation.kind,
      lineageId: creation.lineage_id,
      versionId: creation.id,
      version: creation.version,
      title: 'title' in creation.content ? creation.content.title : creation.kind,
    };
  });
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
  return { ...saved, content, imported: false as const };
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
    .maybeSingle();
  if (owner.error || !owner.data) throw new IntelligenceError('Attachment project unavailable.', 404);
  const existing = await client
    .from('ai_studio_references')
    .select('id')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (existing.error) throw new IntelligenceError('Attachment could not be verified.', 503);
  if (existing.data) return { id, projectId };
  const auth = await client.auth.getUser();
  if (!auth.data.user) throw new IntelligenceError('Session expired.', 401);
  const key = `${auth.data.user.id}/${projectId}/${id}.${referenceExtension(mediaType)}`;
  const stored = await client.storage.from(bucket).download(key);
  if (stored.error || !stored.data)
    throw new IntelligenceError('Upload did not finish. Try selecting the image again.', 409);
  const bytes = new Uint8Array(await stored.data.arrayBuffer());
  if (referenceType(bytes) !== mediaType) {
    await client.storage.from(bucket).remove([key]);
    throw new IntelligenceError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.', 422);
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
