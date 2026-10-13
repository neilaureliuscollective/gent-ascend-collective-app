import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { liveConfig } from '@/domains/live/config';
import { generateStudio, bucket, verifyStudioProject } from '@/domains/studio/service';
import { imageProposal, visualProposal, type ArtifactWorkspace } from './contract';
import { coworkerProposal } from './coworker';
import { renderCoworkerReview } from './coworker-review';
import { renderResearchVisual } from './research-visual';
import { visualSchema } from './visual';
import { renderVisual, VisualProviderError } from '@/platform/openai/visual';
import { aiConfigSchema } from '@/domains/intelligence/validation';
type ArtifactSession = Awaited<ReturnType<typeof intelligenceSession>>;
export type ArtifactAdmission = 'live' | 'talk';
export async function proposeImage(
  input: unknown,
  scope?: ArtifactSession,
  admission: ArtifactAdmission = 'live',
) {
  if (admission === 'live') liveConfig();
  const parsed = imageProposal.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the image proposal.');
  const { client } = scope ?? (await intelligenceSession());
  const access = await currentAccess();
  if (admission === 'talk') {
    if (!access.has('studio.create'))
      throw new IntelligenceError('Studio image creation is not enabled for this account.', 403);
  } else if (!scope && (!access.has('voice.use') || !access.has('studio.create')))
    throw new IntelligenceError('Live Studio creation is not enabled for this account.', 403);
  const job = parsed.data;
  const result = await client.rpc('ai_propose_image_artifact', {
    p_id: job.id,
    p_conversation: job.conversationId,
    p_operation: job.operation,
    p_prompt: job.prompt,
    p_project: job.projectId,
  });
  if (result.error || !result.data)
    throw new IntelligenceError(
      'Proposal not saved. Select a completed image for an edit, or refresh the conversation.',
      409,
    );
  return { id: job.id };
}
export async function readArtifacts(
  conversationId: string,
  scope?: ArtifactSession,
): Promise<ArtifactWorkspace> {
  const { client, person } = scope ?? (await intelligenceSession());
  const conversation = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .maybeSingle();
  if (conversation.error || !conversation.data)
    throw new IntelligenceError('Conversation unavailable.', 404);
  const pending = await client
    .from('ai_conversation_artifacts')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('person_id', person.id)
    .in('status', ['running', 'uncertain'])
    .limit(24);
  if (pending.error) throw new IntelligenceError('Artifact status unavailable.', 503);
  for (const job of pending.data ?? []) {
    const reconciled = await client.rpc('ai_reconcile_artifact', { p_id: job.id });
    if (reconciled.error) throw new IntelligenceError('Image save could not be verified.', 503);
  }
  const [artifacts, selected, projects] = await Promise.all([
    client
      .from('ai_conversation_artifacts')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('person_id', person.id)
      .order('created_at', { ascending: false })
      .limit(24),
    client
      .from('ai_artifact_selection')
      .select('artifact_id,part_id,scenario_percent')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId)
      .maybeSingle(),
    client
      .from('ai_studio_projects')
      .select('id,title')
      .eq('person_id', person.id)
      .is('company_id', null)
      .order('updated_at', { ascending: false })
      .limit(50),
  ]);
  if (artifacts.error || selected.error || projects.error)
    throw new IntelligenceError('Artifacts could not be loaded.', 503);
  const records = artifacts.data ?? [];
  // A review may return to a source older than the recent-work window.
  if (selected.data && !records.some((item) => item.id === selected.data!.artifact_id)) {
    const active = await client
      .from('ai_conversation_artifacts')
      .select('*')
      .eq('id', selected.data.artifact_id)
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (active.error) throw new IntelligenceError('Selected work could not be loaded.', 503);
    if (active.data) records.push(active.data);
  }
  return {
    artifacts: records.map((item) => {
      if (!item.operation.startsWith('visual.')) return item;
      const parsed = visualSchema.safeParse(item.visual);
      return {
        ...item,
        visual: parsed.success ? parsed.data : null,
        status:
          item.status === 'complete' && !parsed.success ? ('uncertain' as const) : item.status,
      };
    }),
    selectedId: selected.data?.artifact_id ?? null,
    selectedPartId: selected.data?.part_id ?? null,
    scenarioPercent: selected.data?.scenario_percent ?? 0,
    projects: projects.data ?? [],
  };
}
export async function selectArtifact(
  conversationId: string,
  artifactId: string,
  partId?: string | null,
) {
  const { client } = await intelligenceSession();
  const result =
    partId !== undefined
      ? await client.rpc('ai_select_visual_part', {
          p_conversation: conversationId,
          p_artifact: artifactId,
          p_part: partId,
        })
      : await client.rpc('ai_select_artifact', {
          p_conversation: conversationId,
          p_artifact: artifactId,
        });
  if (result.error || !result.data)
    throw new IntelligenceError('This creation could not be selected.', 409);
}
export async function reviewArtifact(
  id: string,
  approve: boolean,
  admission: ArtifactAdmission = 'live',
) {
  if (admission === 'live') liveConfig();
  const { client, person } = await intelligenceSession();
  const access = await currentAccess();
  const found = await client
    .from('ai_conversation_artifacts')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .single();
  if (found.error || !found.data) throw new IntelligenceError('Creation request unavailable.', 404);
  const isVisual = found.data.operation.startsWith('visual.');
  if (admission === 'talk') {
    if (isVisual) throw new IntelligenceError('Talk does not approve Live visual work.', 403);
    if (approve && !access.has('studio.create'))
      throw new IntelligenceError('Studio image creation is not enabled for this account.', 403);
  } else if (!access.has('voice.use') || (approve && !isVisual && !access.has('studio.create')))
    throw new IntelligenceError('Creation access unavailable.', 403);
  const model = isVisual ? aiConfigSchema.parse(process.env).AURELIUS_AI_MODEL : '';
  const result = isVisual
    ? await client.rpc('ai_claim_visual_artifact', { p_id: id, p_approve: approve, p_model: model })
    : await client.rpc('ai_claim_image_artifact', { p_id: id, p_approve: approve });
  if (result.error || !result.data)
    throw new IntelligenceError(
      'Approval was not confirmed. The selection may have changed or this operation is already reserved. Refresh before retrying.',
      409,
    );
  if (!approve) return { run: null };
  if (isVisual) {
    const saved = found.data;
    return {
      run: async () => {
        const started = Date.now();
        let result:
          | Awaited<ReturnType<typeof renderVisual>>
          | Awaited<ReturnType<typeof renderCoworkerReview>>
          | null = null;
        let failure: VisualProviderError | null = null;
        try {
          const auth = await client.auth.getUser();
          if (auth.error || !auth.data.user) throw new Error('Session unavailable');
          result =
            saved.operation === 'visual.review'
              ? await renderCoworkerReview(
                  saved.prompt,
                  saved.review_coworker!,
                  saved.review_scope!,
                  saved.review_context ?? {},
                  model,
                )
              : saved.operation === 'visual.chart' ||
                  saved.operation === 'visual.research-comparison'
                ? await renderResearchVisual(
                    saved.prompt,
                    saved.operation === 'visual.chart' ? 'chart' : 'research-comparison',
                    model,
                  )
                : await renderVisual(
                    saved.prompt,
                    saved.operation === 'visual.diagram' ? 'diagram' : 'comparison',
                    model,
                  );
        } catch (error) {
          if (error instanceof VisualProviderError) failure = error;
          /* An admitted provider attempt remains reserved; no automatic paid replay. */
        }
        await client.rpc('ai_finish_metered_visual_artifact', {
          p_id: id,
          p_visual: result?.board ?? null,
          p_text: result?.text ?? '',
          p_input: result?.input ?? failure?.input ?? null,
          p_output: result?.output ?? failure?.output ?? null,
          p_duration: Date.now() - started,
          p_stages: result?.stages ?? failure?.stages ?? 1,
          p_usage_complete: result?.usageComplete ?? failure?.usageComplete ?? false,
        });
      },
    };
  }
  const job = await client
    .from('ai_conversation_artifacts')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .single();
  if (job.error || !job.data?.project_id)
    throw new IntelligenceError('Reserved work status unavailable. Refresh; do not resubmit.', 503);
  const saved = job.data;
  return {
    run: async () => {
      const auth = await client.auth.getUser();
      const authId = auth.data.user?.id;
      const previewKeys: string[] = [];
      try {
        await generateStudio(
          {
            id: saved.id,
            projectId: saved.project_id!,
            parentId: saved.base_version_id,
            referenceId: null,
            prompt: saved.prompt,
            mode: 'fast',
            size: '1024x1024',
          },
          undefined,
          true,
          async (bytes, index) => {
            if (!authId) return;
            const key =
              authId + '/' + saved.project_id + '/' + saved.id + '.partial-' + index + '.png';
            try {
              const uploaded = await client.storage.from(bucket).upload(key, bytes, {
                contentType: 'image/png',
                upsert: false,
                cacheControl: 'private, no-store',
              });
              if (uploaded.error) return;
              previewKeys.push(key);
              await client.rpc('ai_artifact_preview', {
                p_id: saved.id,
                p_index: index,
                p_key: key,
              });
            } catch {
              /* Provisional feedback failure must not discard the final paid result. */
            }
          },
        );
      } catch {
        /* Studio preserves the paid reservation; never blindly replay an uncertain operation. */
      }
      await client.rpc('ai_reconcile_artifact', { p_id: id });
      if (previewKeys.length) await client.storage.from(bucket).remove(previewKeys);
    },
  };
}
export const imageWorkTool = {
  type: 'function',
  name: 'request_image_work',
  description:
    'Propose creating an image or editing the explicitly selected completed image. Only on user request. This creates an approval card, not an image. The person approves paid generation in the workspace. Keep conversing while it runs. Never invent an image, project, completion or image contents.',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['image.create', 'image.edit'] },
      prompt: { type: 'string' },
    },
    required: ['operation', 'prompt'],
    additionalProperties: false,
  },
};

export async function artifactPreview(id: string) {
  const { client, person } = await intelligenceSession();
  const data = await client
    .from('ai_conversation_artifacts')
    .select('project_id,preview_key,status')
    .eq('id', id)
    .eq('person_id', person.id)
    .single();
  if (
    data.error ||
    !data.data?.preview_key ||
    !data.data.project_id ||
    !['running', 'uncertain'].includes(data.data.status)
  )
    throw new IntelligenceError('Preview unavailable.', 404);
  await verifyStudioProject(data.data.project_id);
  const image = await client.storage.from(bucket).download(data.data.preview_key);
  if (image.error || !image.data) throw new IntelligenceError('Preview unavailable.', 404);
  return image.data;
}

export async function proposeVisual(input: unknown, scope?: ArtifactSession) {
  liveConfig();
  const parsed = visualProposal.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the visual proposal.');
  const { client } = scope ?? (await intelligenceSession());
  if (!scope && !(await currentAccess()).has('voice.use'))
    throw new IntelligenceError('Live creation unavailable.', 403);
  const job = parsed.data;
  const result = await client.rpc('ai_propose_visual_artifact', {
    p_id: job.id,
    p_conversation: job.conversationId,
    p_operation: job.operation,
    p_prompt: job.prompt,
  });
  if (result.error || !result.data)
    throw new IntelligenceError('Visual proposal was not saved. Refresh before retrying.', 409);
  return { id: job.id };
}
export const visualWorkTool = {
  type: 'function',
  name: 'request_visual_work',
  description:
    'On explicit user request, propose a conceptual diagram/comparison, or a public-research chart/source-linked comparison. Research sends only the reviewed standalone public task, never private profile or conversation context. This creates a human approval card, not completed output. The fixed renderer cannot execute code or external actions. Conceptual modes do not search. Chart and research-comparison modes use read-only public research and labeled source-linked extraction, never independent fact verification. No tools can execute privileged actions. Keep talking while approved work runs.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['diagram', 'comparison', 'chart', 'research-comparison'] },
      prompt: { type: 'string' },
    },
    required: ['kind', 'prompt'],
    additionalProperties: false,
  },
};

export async function selectScenario(conversationId: string, artifactId: string, percent: number) {
  const { client } = await intelligenceSession();
  const result = await client.rpc('ai_set_chart_scenario', {
    p_conversation: conversationId,
    p_artifact: artifactId,
    p_percent: percent,
  });
  if (result.error || !result.data)
    throw new IntelligenceError('Scenario selection was not confirmed.', 409);
}

export async function proposeCoworker(input: unknown, scope?: ArtifactSession) {
  liveConfig();
  const parsed = coworkerProposal.safeParse(input);
  if (!parsed.success) throw new IntelligenceError('Check the coworker review request.');
  const { client } = scope ?? (await intelligenceSession());
  if (!scope && !(await currentAccess()).has('voice.use'))
    throw new IntelligenceError('Live coworker review unavailable.', 403);
  const job = parsed.data;
  const result = await client.rpc('ai_propose_coworker_review', {
    p_id: job.id,
    p_conversation: job.conversationId,
    p_prompt: job.prompt,
    p_coworker: job.coworker,
    p_scope: job.contextScope,
  });
  if (result.error || !result.data)
    throw new IntelligenceError(
      'Review proposal was not saved. Select a completed visual part for shared context, or choose task only.',
      409,
    );
  return { id: job.id };
}
export const coworkerWorkTool = {
  type: 'function',
  name: 'request_coworker_review',
  description:
    'Only on explicit user request, propose one existing Council coworker review. task-only shares the reviewed standalone task; selected-part shares a server-captured snapshot of the explicitly selected completed visual component/option/point. Human approval reviews exact task, recipient, context and cost. No profile, memory, unrelated transcript, image pixels, web search, record changes or privileged tools. The coworker returns an AI suggestion, not verified facts or executed actions. Keep conversing while approved work runs.',
  parameters: {
    type: 'object',
    properties: {
      coworker: { type: 'string', enum: ['athena', 'prometheus', 'apollo', 'hermes', 'themis'] },
      contextScope: { type: 'string', enum: ['task-only', 'selected-part'] },
      prompt: { type: 'string' },
    },
    required: ['coworker', 'contextScope', 'prompt'],
    additionalProperties: false,
  },
};
