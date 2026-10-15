import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseComposition } from '../composition/model';
import { materializeCompositionAssets } from './materialize';
import { renderComposition } from './ffmpeg';
import {
  IDLE_POLL_MS,
  attemptObjectKeys,
  publishOrReconcileAttempt,
  queueErrorBackoffMs,
  shouldRecoverWhileIdle,
} from './attempt-storage';
import { createServer, type Server } from 'node:http';
import {
  healthBind,
  healthPort,
  rendererPreflight,
  renderConcurrency,
  RENDER_SHUTDOWN_MS,
  sanitizeWorkerLog,
} from './preflight';
import { classifyHealth, workerIdentity } from './health';
import { RENDER_LIMITS, TempBudget, jobDeadlineAt } from './limits';
import { parsePinnedDesignDocument, runDesignExportJob } from './design-job';
import { combineAbortSignals } from './process';

const IMAGE_BUCKET = 'aethelios-studio';
const RENDER_BUCKET = 'aethelios-studio-renders';
const MAX_ATTEMPTS = 3;

type FilmJob = {
  kind: 'film';
  id: string;
  person_id: string;
  project_id: string;
  composition_id: string;
  revision_id: string;
  status: string;
  retry_count: number;
  created_at: string;
};

type DesignJob = {
  kind: 'design';
  id: string;
  person_id: string;
  project_id: string;
  design_id: string;
  revision_id: string;
  format: 'png' | 'svg' | 'pdf';
  font_mode: 'embed' | 'outline';
  status: string;
  retry_count: number;
  created_at: string;
};

type Job = FilmJob | DesignJob;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Studio render worker.`);
  return value;
}

function client() {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let stopping = false;
const active = new Map<string, AbortController>();
let health: Server | null = null;
const limit = renderConcurrency();
let lastQueueOkAt: number | null = null;
let lastQueueError: string | null = null;
let preflightOk = false;

async function main() {
  const supervised = process.argv.includes('--supervised') || process.env.STUDIO_RENDER_WORKER_MODE === 'supervised';
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  const preflight = await rendererPreflight();
  preflightOk = Boolean(preflight.ok && preflight.libx264);
  if (!preflightOk) throw new Error(preflight.ffmpegError || preflight.rasterError || 'Studio render preflight failed.');
  health = listenHealth(preflight);
  console.error(
    sanitizeWorkerLog(
      `Studio render worker ready. FFmpeg ${preflight.ffmpeg?.version}. Concurrency ${limit}. Identity ${workerIdentity() ?? 'unset'}. Hosted rendering remains unavailable until this process is separately commissioned.`,
    ),
  );
  const db = client();
  await recoverAndRequeue(db);
  let idleTicks = 0;
  let queueFailures = 0;
  do {
    if (stopping) break;
    try {
      if (active.size >= limit) {
        await sleep(IDLE_POLL_MS);
        continue;
      }
      const job = await nextJob(db);
      markQueueOk();
      queueFailures = 0;
      if (!job) {
        if (!supervised) break;
        idleTicks += 1;
        if (shouldRecoverWhileIdle(idleTicks)) await recoverAndRequeue(db);
        await sleep(IDLE_POLL_MS);
        continue;
      }
      idleTicks = 0;
      await processQueued(db, job);
      await recoverAndRequeue(db);
    } catch (error) {
      queueFailures += 1;
      markQueueError(error);
      console.error(
        sanitizeWorkerLog(`Studio render queue error: ${error instanceof Error ? error.message : 'unknown'}`),
      );
      if (!supervised) throw error;
      await sleep(queueErrorBackoffMs(queueFailures));
    }
  } while (supervised && !stopping);
}

function markQueueOk() {
  lastQueueOkAt = Date.now();
  lastQueueError = null;
}

function markQueueError(error: unknown) {
  lastQueueError = error instanceof Error ? error.message.slice(0, 180) : 'unknown';
}

function listenHealth(preflight: Awaited<ReturnType<typeof rendererPreflight>>) {
  const port = healthPort();
  if (!port) return null;
  const server = createServer((request, response) => {
    if (request.url !== '/health' && request.url !== '/') {
      response.writeHead(404);
      response.end();
      return;
    }
    const classified = classifyHealth({
      stopping,
      preflightOk,
      lastQueueOkAt,
      lastQueueError,
      identity: workerIdentity(),
    });
    const body = JSON.stringify({
      status: classified.status,
      reason: classified.reason,
      identity: workerIdentity(),
      commissioned: process.env.STUDIO_RENDER_COMMISSIONED === 'true',
      queue: lastQueueError ? 'failing' : lastQueueOkAt ? 'connected' : 'unknown',
      lastQueueOkAt: lastQueueOkAt ? new Date(lastQueueOkAt).toISOString() : null,
      lastQueueError,
      film: preflight.film,
      designExport: preflight.designExport,
      raster: preflight.raster,
      ffmpeg: preflight.ffmpeg
        ? { version: preflight.ffmpeg.version, libx264: preflight.libx264 }
        : null,
      active: active.size,
      concurrency: limit,
      limits: {
        jobMs: RENDER_LIMITS.jobMs,
        downloadMs: RENDER_LIMITS.downloadMs,
        probeMs: RENDER_LIMITS.probeMs,
        maxInputBytes: RENDER_LIMITS.maxInputBytes,
        maxTempBytes: RENDER_LIMITS.maxTempBytes,
      },
    });
    response.writeHead(classified.http, { 'content-type': 'application/json' });
    response.end(body);
  });
  server.listen(port, healthBind());
  return server;
}

async function recoverAndRequeue(db: ReturnType<typeof client>) {
  const recovered = await db.rpc('ai_studio_render_recover');
  if (recovered.error) throw new Error(recovered.error.message || 'Studio render recover failed.');
  const requeued = await db.rpc('ai_studio_render_requeue');
  if (requeued.error) throw new Error(requeued.error.message || 'Studio render requeue failed.');
  const designRecovered = await db.rpc('ai_studio_design_export_recover');
  if (designRecovered.error) throw new Error(designRecovered.error.message || 'Studio design export recover failed.');
  const designRequeued = await db.rpc('ai_studio_design_export_requeue');
  if (designRequeued.error) throw new Error(designRequeued.error.message || 'Studio design export requeue failed.');
  markQueueOk();
}

async function shutdown() {
  stopping = true;
  for (const abort of active.values()) abort.abort();
  const deadline = Date.now() + RENDER_SHUTDOWN_MS;
  while (active.size && Date.now() < deadline) await sleep(200);
  for (const abort of active.values()) abort.abort();
  health?.close();
}

async function nextJob(db: ReturnType<typeof client>): Promise<Job | null> {
  const [film, design] = await Promise.all([
    db
      .from('ai_studio_render_jobs')
      .select('id,person_id,project_id,composition_id,revision_id,status,retry_count,created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('ai_studio_design_export_jobs')
      .select('id,person_id,project_id,design_id,revision_id,format,font_mode,status,retry_count,created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (film.error) throw new Error(film.error.message || 'Studio render queue could not be read.');
  if (design.error) throw new Error(design.error.message || 'Studio design export queue could not be read.');
  const filmJob = film.data ? ({ kind: 'film', ...film.data } as FilmJob) : null;
  const designJob = design.data ? ({ kind: 'design', ...design.data } as DesignJob) : null;
  if (filmJob && designJob)
    return filmJob.created_at <= designJob.created_at ? filmJob : designJob;
  return filmJob ?? designJob;
}

async function processQueued(db: ReturnType<typeof client>, job: Job) {
  if (job.kind === 'design') await processDesignJob(db, job);
  else await processFilmJob(db, job);
}

async function processDesignJob(db: ReturnType<typeof client>, job: DesignJob) {
  const abort = new AbortController();
  active.set(job.id, abort);
  try {
    const revision = await db
      .from('ai_studio_design_revisions')
      .select('document,person_id,project_id,design_id')
      .eq('id', job.revision_id)
      .eq('person_id', job.person_id)
      .eq('project_id', job.project_id)
      .maybeSingle();
    if (revision.error || !revision.data) throw new Error('Pinned design revision unavailable.');
    const document = parsePinnedDesignDocument(revision.data.document);
    await runDesignExportJob({
      client: db,
      personId: job.person_id,
      jobId: job.id,
      document,
      projectId: job.project_id,
      format: job.format,
      fontMode: job.font_mode,
      signal: abort.signal,
    });
    console.error(sanitizeWorkerLog(`Studio design export ${job.id} complete (${job.format}).`));
  } catch (error) {
    console.error(
      sanitizeWorkerLog(`Studio design export ${job.id} failed: ${error instanceof Error ? error.message : 'unknown'}`),
    );
  } finally {
    active.delete(job.id);
  }
}

async function processFilmJob(db: ReturnType<typeof client>, job: FilmJob) {
  const token = crypto.randomUUID();
  const claimed = await db.rpc('ai_studio_render_claim', { p_id: job.id, p_token: token });
  if (claimed.error || !claimed.data) return;
  const abort = new AbortController();
  active.set(job.id, abort);
  const deadlineAt = jobDeadlineAt();
  const signal = combineAbortSignals([abort.signal, AbortSignal.timeout(RENDER_LIMITS.jobMs)]);
  const beat = setInterval(() => {
    void db.rpc('ai_studio_render_heartbeat', { p_id: job.id, p_token: token }).then(async (pulse) => {
      const row = await db.from('ai_studio_render_jobs').select('status,lease_token').eq('id', job.id).maybeSingle();
      if (!pulse.data || row.data?.status === 'cancelled' || row.data?.lease_token !== token) abort.abort();
    });
  }, 15_000);
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-worker-'));
  const uploaded: string[] = [];
  try {
    const revision = await db
      .from('ai_studio_composition_revisions')
      .select('document,person_id,project_id,composition_id')
      .eq('id', job.revision_id)
      .eq('person_id', job.person_id)
      .eq('project_id', job.project_id)
      .maybeSingle();
    if (revision.error || !revision.data) throw new Error('Pinned composition revision unavailable.');
    const document = parseComposition(revision.data.document);
    const person = await db.from('persons').select('auth_user_id').eq('id', job.person_id).maybeSingle();
    const uid = person.data?.auth_user_id as string | undefined;
    if (!uid) throw new Error('Owner identity unavailable for private film storage.');
    const assets = await materializeCompositionAssets({
      client: db,
      personId: job.person_id,
      projectId: job.project_id,
      document,
      dir,
      imageBucket: IMAGE_BUCKET,
      signal,
      budget: new TempBudget(),
    });
    if (signal.aborted) throw new Error('Studio render was cancelled.');
    const rendered = await renderComposition(document, assets, { signal, deadlineAt });
    if (signal.aborted) throw new Error('Studio render was cancelled.');
    const keys = attemptObjectKeys({ uid, projectId: job.project_id, jobId: job.id, token });
    const bucket = db.storage.from(RENDER_BUCKET);
    const remove = async (paths: string[]) => {
      if (paths.length) await bucket.remove(paths);
    };
    const uploads = await Promise.all([
      bucket.upload(keys.film, rendered.film, { contentType: 'video/mp4', upsert: false }),
      bucket.upload(keys.cover, rendered.cover, { contentType: 'image/png', upsert: false }),
      bucket.upload(keys.captions, rendered.captions, { contentType: 'text/vtt', upsert: false }),
    ]);
    uploaded.push(keys.film, keys.cover, keys.captions);
    if (uploads.some((item) => item.error)) throw new Error('The film could not be stored privately.');
    const still = await db.from('ai_studio_render_jobs').select('status,lease_token,storage_film,storage_cover,storage_captions').eq('id', job.id).maybeSingle();
    if (still.data?.status === 'cancelled' || still.data?.lease_token !== token) {
      await remove(uploaded);
      throw new Error('Studio render was cancelled.');
    }
    const outcome = await publishOrReconcileAttempt({
      finish: async () =>
        await db.rpc('ai_studio_render_finish', {
          p_id: job.id,
          p_token: token,
          p_film: keys.film,
          p_cover: keys.cover,
          p_captions: keys.captions,
          p_width: rendered.width,
          p_height: rendered.height,
          p_duration: rendered.durationMs,
        }),
      readJob: async () => {
        const row = await db
          .from('ai_studio_render_jobs')
          .select('status,lease_token,storage_film,storage_cover,storage_captions')
          .eq('id', job.id)
          .maybeSingle();
        if (row.error) return { available: false as const, reason: row.error.message };
        return { available: true as const, row: row.data };
      },
      uploaded,
      remove,
      token,
    });
    if (!outcome.published)
      throw new Error('Completion receipt was rejected; late output was not published.');
    console.error(sanitizeWorkerLog(`Studio render ${job.id} complete (${rendered.durationMs}ms).`));
  } catch (error) {
    await db.rpc('ai_studio_render_fail', {
      p_id: job.id,
      p_token: token,
      p_code: abort.signal.aborted ? 'cancelled' : job.retry_count + 1 >= MAX_ATTEMPTS ? 'render_failed' : 'retry',
    });
    console.error(
      sanitizeWorkerLog(`Studio render ${job.id} failed: ${error instanceof Error ? error.message : 'unknown'}`),
    );
  } finally {
    clearInterval(beat);
    active.delete(job.id);
    await rm(dir, { recursive: true, force: true });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(sanitizeWorkerLog(error instanceof Error ? error.message : 'Studio render worker failed.'));
  process.exit(1);
});
