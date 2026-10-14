import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession, verifyStudioProject, bucket as imageBucket } from './service';
import { parseComposition, type CompositionDocument } from './composition/model';
import { hostedRenderConfigured, inspectFfmpeg, renderComposition } from './render/ffmpeg';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { LocalAsset } from './composition/compile';
import { compositionVtt, compositionSrt } from './composition/captions';

export const compositionSaveInput = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    document: z.unknown(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().min(0),
  })
  .strict();

type SaveRow = { id: string; revision: number; updated_at: string };

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

export async function freezeComposition(compositionId: string) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_composition_freeze', { p_id: compositionId });
  if (result.error || !result.data)
    throw new IntelligenceError('The film revision could not be frozen.', 409);
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
  const duplicate = begun.data === false;
  const hosted = hostedRenderConfigured();
  if (!executeLocal || hosted) {
    return {
      id: input.id,
      status: duplicate ? 'existing' : 'queued',
      hosted,
      local: false,
      note: hosted
        ? 'Hosted render worker is configured.'
        : 'Hosted rendering is unavailable. A local FFmpeg worker is required. This job stays queued; it is not marked complete.',
    };
  }
  return executeRender(input.id, revision.document, input.projectId);
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
  try {
    const assets = await materializeAssets(document, projectId, dir);
    const rendered = await renderComposition(document, assets);
    const user = (await client.auth.getUser()).data.user;
    if (!user) throw new IntelligenceError('Sign in to store a film.', 401);
    const prefix = `${user.id}/${projectId}/${jobId}`;
    const filmKey = `${prefix}/film.mp4`;
    const coverKey = `${prefix}/cover.png`;
    const captionKey = `${prefix}/captions.vtt`;
    const bucket = client.storage.from('aethelios-studio-renders');
    const uploads = await Promise.all([
      bucket.upload(filmKey, rendered.film, { contentType: 'video/mp4', upsert: true }),
      bucket.upload(coverKey, rendered.cover, { contentType: 'image/png', upsert: true }),
      bucket.upload(captionKey, rendered.captions, { contentType: 'text/vtt', upsert: true }),
    ]);
    if (uploads.some((item) => item.error))
      throw new IntelligenceError('The film could not be stored privately.', 503);
    const finished = await client.rpc('ai_studio_render_finish', {
      p_id: jobId,
      p_token: token,
      p_film: filmKey,
      p_cover: coverKey,
      p_captions: captionKey,
      p_width: rendered.width,
      p_height: rendered.height,
      p_duration: rendered.durationMs,
    });
    if (finished.error || !finished.data)
      throw new IntelligenceError(
        'The film was stored but the completion receipt could not be confirmed. Refresh before starting another render.',
        409,
      );
    void person;
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
      p_code: 'render_failed',
    });
    throw error instanceof IntelligenceError
      ? error
      : new IntelligenceError(error instanceof Error ? error.message : 'The film could not be rendered.', 503);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function materializeAssets(document: CompositionDocument, projectId: string, dir: string) {
  await mkdir(dir, { recursive: true });
  const { client, person } = await studioSession();
  const assets: LocalAsset[] = [];
  const used = new Map<string, LocalAsset>();
  const add = async (
    kind: LocalAsset['kind'],
    id: string,
    table: 'ai_studio_versions' | 'ai_studio_references' | 'ai_studio_footage' | 'ai_studio_narrations',
    storageBucket: string,
    media: LocalAsset['media'],
    ext: string,
  ) => {
    const key = `${kind}:${id}`;
    if (used.has(key)) {
      assets.push(used.get(key)!);
      return;
    }
    const row = await client
      .from(table)
      .select('id,storage_key,project_id')
      .eq('id', id)
      .eq('person_id', person.id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (row.error || !row.data?.storage_key)
      throw new IntelligenceError('A film asset is not available in this project.', 404);
    const file = await client.storage.from(storageBucket).download(row.data.storage_key);
    if (file.error || !file.data)
      throw new IntelligenceError('A film asset could not be read from private storage.', 403);
    const target = path.join(dir, `${kind}-${id}.${ext}`);
    await writeFile(target, Buffer.from(await file.data.arrayBuffer()));
    const asset = { id, kind, path: target, media };
    used.set(key, asset);
    assets.push(asset);
  };
  for (const scene of document.scenes) {
    if (scene.kind === 'image')
      await add(
        scene.assetKind,
        scene.assetId,
        scene.assetKind === 'version' ? 'ai_studio_versions' : 'ai_studio_references',
        imageBucket,
        'image',
        'png',
      );
    else await add('footage', scene.assetId, 'ai_studio_footage', 'aethelios-studio-video', 'video', 'mp4');
  }
  if (document.narration)
    await add('narration', document.narration.assetId, 'ai_studio_narrations', 'aethelios-studio-audio', 'wav', 'wav');
  if (document.music)
    await add('music', document.music.assetId, 'ai_studio_narrations', 'aethelios-studio-audio', 'wav', 'wav');
  return assets;
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
  return {
    hosted: hostedRenderConfigured() ? 'implemented' : 'unavailable',
    localBinary: ffmpeg ? 'implemented' : 'configuration required',
    ffmpeg,
    note: hostedRenderConfigured()
      ? 'Hosted worker flag is on; confirm the worker process is running.'
      : 'Hosted rendering is unavailable. Run scripts/studio-render-worker.mjs on a host with FFmpeg 6.1+ libx264/aac, or use local execution.',
  };
}
