import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession, verifyStudioProject, bucket as imageBucket } from './service';
import { parseComposition, type CompositionDocument } from './composition/model';
import { inspectFfmpeg, renderComposition, renderWorkerRequested } from './render/ffmpeg';
import { TempBudget } from './render/limits';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { compositionVtt, compositionSrt } from './composition/captions';
import { materializeCompositionAssets } from './render/materialize';
import { attemptObjectKeys, publishOrReconcileAttempt } from './render/attempt-storage';

export const compositionSaveInput = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    document: z.unknown(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().min(0),
    freeze: z.boolean().optional(),
  })
  .strict();

type SaveRow = { id: string; revision: number; updated_at: string; revision_id: string };

export async function saveComposition(input: z.infer<typeof compositionSaveInput>) {
  await verifyStudioProject(input.projectId);
  const document = parseComposition(input.document);
  if (document.id !== input.id) throw new IntelligenceError('Composition identity does not match.', 422);
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_composition_save', {
    p_id: input.id,
    p_project: input.projectId,
    p_title: input.title,
    p_document: document,
    p_updated: input.updatedAt,
    p_expected: input.revision,
    p_freeze: input.freeze ?? false,
  });
  if (result.error) {
    if (result.error.message.includes('COMPOSITION_CONFLICT'))
      throw new IntelligenceError('This film changed elsewhere. Refresh it before saving.', 409);
    throw new IntelligenceError(result.error.message.replace(/^.*ERROR:\s*/i, '') || 'Film could not be saved.', 422);
  }
  const row = Array.isArray(result.data) ? (result.data[0] as SaveRow | undefined) : (result.data as SaveRow | null);
  if (!row) throw new IntelligenceError('Film could not be saved.', 503);
  return { ...row, document };
}

export async function freezeComposition(compositionId: string, expectedRevision: number) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_composition_freeze', {
    p_id: compositionId,
    p_expected: expectedRevision,
  });
  if (result.error || !result.data) {
    if (result.error?.message.includes('STALE_COMPOSITION_REVISION'))
      throw new IntelligenceError('That film revision is no longer the selected freeze target.', 409);
    throw new IntelligenceError('The film revision could not be frozen.', 409);
  }
  return { revisionId: result.data as string };
}

export async function compositionRevision(projectId: string, revisionId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_composition_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (result.error || !result.data)
    throw new IntelligenceError('Film revision not found.', 404);
  return { ...result.data, document: parseComposition(result.data.document) };
}

export const renderStartInput = z
  .object({
    projectId: z.uuid(),
    compositionId: z.uuid(),
    revisionId: z.uuid(),
    id: z.uuid(),
    idempotencyKey: z.uuid(),
  })
  .strict();

export async function startRender(input: z.infer<typeof renderStartInput>, executeLocal = true) {
  await verifyStudioProject(input.projectId);
  const revision = await compositionRevision(input.projectId, input.revisionId);
  if (revision.composition_id !== input.compositionId)
    throw new IntelligenceError('Render from the pinned film revision.', 422);
  const { client } = await studioSession();
  const begun = await client.rpc('ai_studio_render_begin', {
    p_id: input.id,
    p_project: input.projectId,
    p_composition: input.compositionId,
    p_revision: input.revisionId,
    p_key: input.idempotencyKey,
  });
  if (begun.error)
    throw new IntelligenceError(begun.error.message.replace(/^.*ERROR:\s*/i, '') || 'Render could not start.', 422);
  const row = (Array.isArray(begun.data) ? begun.data[0] : begun.data) as
    | { id: string; status: string; created: boolean }
    | null;
  if (!row?.id) throw new IntelligenceError('Render could not start.', 503);
  if (row.status === 'complete') {
    const existing = await client
      .from('ai_studio_render_jobs')
      .select('id,status,width,height,duration_ms')
      .eq('id', row.id)
      .maybeSingle();
    return {
      id: row.id,
      status: 'complete' as const,
      hosted: false,
      local: false,
      width: existing.data?.width,
      height: existing.data?.height,
      durationMs: existing.data?.duration_ms,
      note: 'Returned the existing finished render for this idempotency key.',
    };
  }
  if (!row.created && row.status !== 'queued') {
    return {
      id: row.id,
      status: row.status === 'running' ? 'existing' : row.status,
      hosted: false,
      local: false,
      note: `Returned the existing ${row.status} render for this idempotency key.`,
    };
  }
  const queueForWorker = renderWorkerRequested() && !executeLocal;
  if (queueForWorker) {
    return {
      id: row.id,
      status: row.created ? 'queued' : 'existing',
      hosted: false,
      local: false,
      note: 'Hosted rendering is unavailable. The job is queued for scripts/studio-render-worker.mjs on a host with FFmpeg 6.1+ libx264/aac. A flag alone is not readiness.',
    };
  }
  return executeRender(row.id, revision.document, input.projectId);
}

export async function cancelRender(id: string) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_render_cancel', { p_id: id });
  if (result.error) throw new IntelligenceError('The render could not be cancelled.', 409);
  return { cancelled: Boolean(result.data) };
}

export async function executeRender(jobId: string, document: CompositionDocument, projectId: string) {
  const { client, person } = await studioSession();
  const token = crypto.randomUUID();
  const claimed = await client.rpc('ai_studio_render_claim', { p_id: jobId, p_token: token });
  if (claimed.error || !claimed.data)
    throw new IntelligenceError('This render could not obtain a lease. It was not marked complete.', 409);
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-job-'));
  const abort = new AbortController();
  const beat = setInterval(() => {
    void client.rpc('ai_studio_render_heartbeat', { p_id: jobId, p_token: token }).then(async (pulse) => {
      const row = await client.from('ai_studio_render_jobs').select('status,lease_token').eq('id', jobId).maybeSingle();
      if (!pulse.data || row.data?.status === 'cancelled' || row.data?.lease_token !== token) abort.abort();
    });
  }, 15_000);
  const uploaded: string[] = [];
  try {
    const assets = await materializeCompositionAssets({
      client,
      personId: person.id,
      projectId,
      document,
      dir,
      imageBucket,
      signal: abort.signal,
      budget: new TempBudget(),
    });
    const rendered = await renderComposition(document, assets, { signal: abort.signal });
    if (abort.signal.aborted) throw new IntelligenceError('Studio render was cancelled.', 409);
    const user = (await client.auth.getUser()).data.user;
    if (!user) throw new IntelligenceError('Sign in to store a film.', 401);
    const keys = attemptObjectKeys({ uid: user.id, projectId, jobId, token });
    const bucket = client.storage.from('aethelios-studio-renders');
    const remove = async (paths: string[]) => {
      if (paths.length) await bucket.remove(paths);
    };
    const uploads = await Promise.all([
      bucket.upload(keys.film, rendered.film, { contentType: 'video/mp4', upsert: false }),
      bucket.upload(keys.cover, rendered.cover, { contentType: 'image/png', upsert: false }),
      bucket.upload(keys.captions, rendered.captions, { contentType: 'text/vtt', upsert: false }),
    ]);
    uploaded.push(keys.film, keys.cover, keys.captions);
    if (uploads.some((item) => item.error))
      throw new IntelligenceError('The film could not be stored privately.', 503);
    const still = await client
      .from('ai_studio_render_jobs')
      .select('status,lease_token,storage_film,storage_cover,storage_captions')
      .eq('id', jobId)
      .maybeSingle();
    if (still.data?.status === 'cancelled' || still.data?.lease_token !== token) {
      await remove(uploaded);
      throw new IntelligenceError('Studio render was cancelled.', 409);
    }
    const outcome = await publishOrReconcileAttempt({
      finish: async () =>
        await client.rpc('ai_studio_render_finish', {
          p_id: jobId,
          p_token: token,
          p_film: keys.film,
          p_cover: keys.cover,
          p_captions: keys.captions,
          p_width: rendered.width,
          p_height: rendered.height,
          p_duration: rendered.durationMs,
        }),
      readJob: async () => {
        const row = await client
          .from('ai_studio_render_jobs')
          .select('status,lease_token,storage_film,storage_cover,storage_captions')
          .eq('id', jobId)
          .maybeSingle();
        if (row.error) return { available: false as const, reason: row.error.message };
        return { available: true as const, row: row.data };
      },
      uploaded,
      remove,
      token,
    });
    if (!outcome.published)
      throw new IntelligenceError(
        'The film was stored but the completion receipt could not be confirmed. Refresh before starting another render.',
        409,
      );
    return {
      id: jobId,
      status: 'complete' as const,
      hosted: false,
      local: true,
      width: rendered.width,
      height: rendered.height,
      durationMs: rendered.durationMs,
      ffmpeg: rendered.ffmpeg,
    };
  } catch (error) {
    await client.rpc('ai_studio_render_fail', {
      p_id: jobId,
      p_token: token,
      p_code: abort.signal.aborted ? 'cancelled' : 'render_failed',
    });
    throw error instanceof IntelligenceError
      ? error
      : new IntelligenceError(error instanceof Error ? error.message : 'The film could not be rendered.', 503);
  } finally {
    clearInterval(beat);
    await rm(dir, { recursive: true, force: true });
  }
}

export async function renderBlob(id: string, kind: 'film' | 'cover' | 'captions') {
  const { client, person } = await studioSession();
  const row = await client
    .from('ai_studio_render_jobs')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('status', 'complete')
    .maybeSingle();
  if (row.error || !row.data) throw new IntelligenceError('Finished film not found.', 404);
  const key =
    kind === 'film' ? row.data.storage_film : kind === 'cover' ? row.data.storage_cover : row.data.storage_captions;
  if (!key) throw new IntelligenceError('Finished film not found.', 404);
  const file = await client.storage.from('aethelios-studio-renders').download(key);
  if (file.error || !file.data) throw new IntelligenceError('Film unavailable.', 503);
  return {
    blob: file.data,
    type: kind === 'film' ? 'video/mp4' : kind === 'cover' ? 'image/png' : 'text/vtt',
  };
}

export function compositionCaptionFiles(document: CompositionDocument) {
  return { vtt: compositionVtt(document), srt: compositionSrt(document) };
}

export async function renderReadiness() {
  let ffmpeg = null;
  try {
    ffmpeg = await inspectFfmpeg();
  } catch {
    ffmpeg = null;
  }
  const healthUrl = process.env.STUDIO_RENDER_HEALTH_URL;
  let workerHealth: { status: string; commissioned?: boolean; film?: string } | null = null;
  let healthError: string | null = null;
  if (healthUrl) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2500) });
      workerHealth = (await response.json()) as { status: string; commissioned?: boolean; film?: string };
    } catch (error) {
      healthError = error instanceof Error ? error.message.slice(0, 120) : 'health unavailable';
    }
  }
  const workerLive =
    workerHealth?.status === 'ok' &&
    workerHealth.film === 'ffmpeg-libx264-aac' &&
    Boolean((workerHealth as { identity?: string }).identity) &&
    (workerHealth as { queue?: string }).queue === 'connected';
  const commissioned = process.env.STUDIO_RENDER_COMMISSIONED === 'true' && workerLive;
  return {
    hosted: commissioned ? ('detected' as const) : ('unavailable' as const),
    commissioned,
    workerRequested: renderWorkerRequested(),
    workerHealth: workerLive ? 'detected' : healthUrl ? 'unavailable' : 'unconfigured',
    healthError,
    localBinary: ffmpeg ? 'implemented' : 'configuration required',
    ffmpeg,
    note: commissioned
      ? 'A commissioned worker answered health with FFmpeg libx264, identity and recent queue contact. This is still not a production renderer until founder authorization.'
      : 'Hosted rendering is unavailable. STUDIO_RENDER_WORKER=true only queues Film and Design export jobs. Package: ops/studio-render. HTTP 200 with binaries only, or a commissioned flag without identity/queue contact, is not readiness.',
  };
}
