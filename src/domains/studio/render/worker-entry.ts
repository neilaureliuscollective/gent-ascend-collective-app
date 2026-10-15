import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseComposition } from '../composition/model';
import { materializeCompositionAssets } from './materialize';
import { inspectFfmpeg, renderComposition } from './ffmpeg';
import {
  IDLE_POLL_MS,
  attemptObjectKeys,
  publishOrReconcileAttempt,
  queueErrorBackoffMs,
  shouldRecoverWhileIdle,
} from './attempt-storage';

const IMAGE_BUCKET = 'aethelios-studio';
const RENDER_BUCKET = 'aethelios-studio-renders';
const MAX_ATTEMPTS = 3;

type Job = {
  id: string;
  person_id: string;
  project_id: string;
  composition_id: string;
  revision_id: string;
  status: string;
  retry_count: number;
};

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

async function main() {
  const supervised = process.argv.includes('--supervised') || process.env.STUDIO_RENDER_WORKER_MODE === 'supervised';
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  const ffmpeg = await inspectFfmpeg();
  if (!ffmpeg.configuration.includes('libx264'))
    throw new Error('The configured FFmpeg build does not include libx264.');
  console.error(
    `Studio render worker ready. FFmpeg ${ffmpeg.version}. Hosted rendering remains unavailable until this process is separately authorized.`,
  );
  const db = client();
  await recoverAndRequeue(db);
  let idleTicks = 0;
  let queueFailures = 0;
  do {
    if (stopping) break;
    try {
      const job = await nextJob(db);
      queueFailures = 0;
      if (!job) {
        if (!supervised) break;
        idleTicks += 1;
        if (shouldRecoverWhileIdle(idleTicks)) await recoverAndRequeue(db);
        await sleep(IDLE_POLL_MS);
        continue;
      }
      idleTicks = 0;
      await processJob(db, job);
      await recoverAndRequeue(db);
    } catch (error) {
      queueFailures += 1;
      console.error(`Studio render queue error: ${error instanceof Error ? error.message : 'unknown'}`);
      if (!supervised) throw error;
      await sleep(queueErrorBackoffMs(queueFailures));
    }
  } while (supervised && !stopping);
}

async function recoverAndRequeue(db: ReturnType<typeof client>) {
  const recovered = await db.rpc('ai_studio_render_recover');
  if (recovered.error) throw new Error(recovered.error.message || 'Studio render recover failed.');
  const requeued = await db.rpc('ai_studio_render_requeue');
  if (requeued.error) throw new Error(requeued.error.message || 'Studio render requeue failed.');
}

function shutdown() {
  stopping = true;
  for (const abort of active.values()) abort.abort();
}

async function nextJob(db: ReturnType<typeof client>): Promise<Job | null> {
  const queued = await db
    .from('ai_studio_render_jobs')
    .select('id,person_id,project_id,composition_id,revision_id,status,retry_count')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queued.error) throw new Error(queued.error.message || 'Studio render queue could not be read.');
  return queued.data as Job | null;
}

async function processJob(db: ReturnType<typeof client>, job: Job) {
  const token = crypto.randomUUID();
  const claimed = await db.rpc('ai_studio_render_claim', { p_id: job.id, p_token: token });
  if (claimed.error || !claimed.data) return;
  const abort = new AbortController();
  active.set(job.id, abort);
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
    });
    if (abort.signal.aborted) throw new Error('Studio render was cancelled.');
    const rendered = await renderComposition(document, assets, { signal: abort.signal });
    if (abort.signal.aborted) throw new Error('Studio render was cancelled.');
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
        return row.data;
      },
      uploaded,
      remove,
      token,
    });
    if (!outcome.published)
      throw new Error('Completion receipt was rejected; late output was not published.');
    console.error(`Studio render ${job.id} complete (${rendered.durationMs}ms).`);
  } catch (error) {
    await db.rpc('ai_studio_render_fail', {
      p_id: job.id,
      p_token: token,
      p_code: abort.signal.aborted ? 'cancelled' : job.retry_count + 1 >= MAX_ATTEMPTS ? 'render_failed' : 'retry',
    });
    console.error(`Studio render ${job.id} failed: ${error instanceof Error ? error.message : 'unknown'}`);
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
  console.error(error instanceof Error ? error.message : 'Studio render worker failed.');
  process.exit(1);
});
