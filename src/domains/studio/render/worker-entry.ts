import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseComposition } from '../composition/model';
import { materializeCompositionAssets } from './materialize';
import { inspectFfmpeg, renderComposition } from './ffmpeg';

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
  await db.rpc('ai_studio_render_recover');
  await db.rpc('ai_studio_render_requeue');
  do {
    if (stopping) break;
    const job = await nextJob(db);
    if (!job) {
      if (!supervised) break;
      await sleep(2000);
      continue;
    }
    await processJob(db, job);
    await db.rpc('ai_studio_render_recover');
    await db.rpc('ai_studio_render_requeue');
  } while (supervised && !stopping);
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
    const prefix = `${uid}/${job.project_id}/${job.id}`;
    const filmKey = `${prefix}/film.mp4`;
    const coverKey = `${prefix}/cover.png`;
    const captionKey = `${prefix}/captions.vtt`;
    const bucket = db.storage.from(RENDER_BUCKET);
    const uploads = await Promise.all([
      bucket.upload(filmKey, rendered.film, { contentType: 'video/mp4', upsert: true }),
      bucket.upload(coverKey, rendered.cover, { contentType: 'image/png', upsert: true }),
      bucket.upload(captionKey, rendered.captions, { contentType: 'text/vtt', upsert: true }),
    ]);
    uploaded.push(filmKey, coverKey, captionKey);
    if (uploads.some((item) => item.error)) throw new Error('The film could not be stored privately.');
    const still = await db.from('ai_studio_render_jobs').select('status,lease_token').eq('id', job.id).maybeSingle();
    if (still.data?.status === 'cancelled' || still.data?.lease_token !== token) {
      await Promise.all(uploaded.map((key) => bucket.remove([key])));
      throw new Error('Studio render was cancelled.');
    }
    const finished = await db.rpc('ai_studio_render_finish', {
      p_id: job.id,
      p_token: token,
      p_film: filmKey,
      p_cover: coverKey,
      p_captions: captionKey,
      p_width: rendered.width,
      p_height: rendered.height,
      p_duration: rendered.durationMs,
    });
    if (finished.error || !finished.data) {
      await Promise.all(uploaded.map((key) => bucket.remove([key])));
      throw new Error('Completion receipt was rejected; late output was not published.');
    }
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
