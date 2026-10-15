import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { sanitizeLog } from '@/domains/architect-construct/sanitize';
import { supabaseConnection } from '@/platform/supabase/connection';
import {
  appsDeploymentMode,
  appsProcessIdentity,
  appsWorkerAuthorized,
  appsWorkerIdentity,
  appsWorkerMissingNames,
  classifyAppsWorkerHealth,
  commissionedAppsWorkerReady,
  hostedWorkerPlaneForbidden,
  probeAppsSchemaFromClient,
} from './commission';
import { createWorkerAppStore } from './database-store';
import { buildIsolatedGeneratedApp, inspectAppsImageDigest, parseAppsImageDigest, probeAppsDockerIsolation } from './isolate';
import { notesSourceFiles } from './notes-fixture';
import { appsGenerationPolicy } from './generation-policy';
import { appsControlPlaneReady } from './readiness';
import { superviseAppsWorker } from './supervisor';
import { processAppBuildOnce } from './worker';
import { appsWorkRoot, inspectAppsWorkRoot, proveWorkerOwnedWorkspace } from './work-root';

function report(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
}

async function reportWorkerPresence(
  health: ReturnType<typeof classifyAppsWorkerHealth>,
  evidence: Awaited<ReturnType<typeof gatherEvidence>>,
) {
  try {
    const connection = supabaseConnection(process.env);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const digest = evidence.observedDigest ?? parseAppsImageDigest(process.env.ARCHITECT_APPS_IMAGE_DIGEST);
    if (!connection || !serviceKey || !digest || !health.workerId) return false;
    const client = createClient(connection.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const result = await client.rpc('architect_apps_report_worker_presence', {
      p_worker: health.workerId,
      p_digest: digest,
      p_isolation: health.isolation,
      p_schema: evidence.schemaCompatible,
      p_queue: evidence.schemaCompatible,
      p_artifacts: evidence.schemaCompatible,
      p_state: health.state,
    });
    return !result.error;
  } catch {
    return false;
  }
}

async function gatherEvidence(env: NodeJS.ProcessEnv = process.env) {
  const isolation = await probeAppsDockerIsolation(env);
  const observedDigest = isolation.available ? await inspectAppsImageDigest(env) : null;
  let connection = null as ReturnType<typeof supabaseConnection>;
  try {
    connection = supabaseConnection(env);
  } catch {
    connection = null;
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let schemaCompatible = false;
  let schemaClassification: 'ok' | 'unavailable' | 'denied' | 'misconfigured' | 'skipped' = 'skipped';
  let schemaMissing: string[] = [];
  if (connection && serviceKey) {
    const client = createClient(connection.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const probe = await probeAppsSchemaFromClient(client);
    schemaCompatible = probe.ok;
    schemaClassification = probe.classification;
    schemaMissing = probe.missing;
  }
  const workRootPath = env.ARCHITECT_APPS_WORK_ROOT?.trim() ? appsWorkRoot(env) : null;
  const workRoot = workRootPath ? inspectAppsWorkRoot(workRootPath) : { ok: true, code: 'ready', reason: null };
  return {
    isolationAvailable: isolation.available,
    observedDigest,
    schemaCompatible,
    schemaClassification,
    schemaMissing,
    isolation,
    workRoot,
  };
}

const proveWrite = process.argv.includes('--prove-write');
const compileFixture = process.argv.includes('--compile-fixture');
const preflight = process.argv.includes('--preflight');
const healthOnly = process.argv.includes('--health');
const supervised =
  process.env.ARCHITECT_APPS_WORKER_MODE === 'supervised' ||
  process.env.ARCHITECT_CONSTRUCT_WORKER_MODE === 'supervised' ||
  process.argv.includes('--supervised');

const evidence = await gatherEvidence();
const generation = appsGenerationPolicy();
const health = classifyAppsWorkerHealth({
  env: process.env,
  isolationAvailable: evidence.isolationAvailable,
  observedDigest: evidence.observedDigest,
  schemaCompatible: evidence.schemaCompatible,
});
const missing = appsWorkerMissingNames();
const identity = appsProcessIdentity();

if (proveWrite) {
  try {
    const root = appsWorkRoot();
    const wrote = proveWorkerOwnedWorkspace(root);
    report({
      ok: true,
      phase: 'prove-write',
      workRoot: root,
      uid: wrote.contract.uid,
      mode: wrote.contract.mode,
      created: true,
      cleaned: true,
    });
    process.exit(0);
  } catch (error) {
    report({
      ok: false,
      phase: 'prove-write',
      reason: error instanceof Error ? error.message : 'Worker could not write the shared work root.',
    });
    process.exit(1);
  }
}

if (compileFixture) {
  try {
    const compiled = await buildIsolatedGeneratedApp(notesSourceFiles(), {
      timeoutMs: 180000,
      name: 'apps-packaged-compile',
    });
    const broken = notesSourceFiles().map((file) =>
      file.path === 'src/App.tsx' ? { ...file, content: 'export const broken: number = "no";\n' } : file,
    );
    const failed = await buildIsolatedGeneratedApp(broken, { timeoutMs: 120000, name: 'apps-packaged-fail' });
    const leftoverWork = readdirSync(appsWorkRoot()).filter((name) => name.startsWith('architect-apps-iso-'));
    const leftoverCompile = spawnSync('docker', ['inspect', 'apps-packaged-compile'], { encoding: 'utf8' });
    const leftoverFail = spawnSync('docker', ['inspect', 'apps-packaged-fail'], { encoding: 'utf8' });
    const containersGone =
      (leftoverCompile.status !== 0 || /no such container/i.test(`${leftoverCompile.stderr}${leftoverCompile.stdout}`)) &&
      (leftoverFail.status !== 0 || /no such container/i.test(`${leftoverFail.stderr}${leftoverFail.stdout}`));
    const ok =
      compiled.result.ok &&
      compiled.result.isolation === 'docker' &&
      compiled.artifacts.some((file) => file.path === 'assets/app.js') &&
      !failed.result.ok &&
      leftoverWork.length === 0 &&
      containersGone;
    report({
      ok,
      phase: 'compile-fixture',
      isolation: compiled.result.isolation,
      sandbox: compiled.result.sandbox,
      artifactCount: compiled.artifacts.length,
      failedCompile: !failed.result.ok,
      cleanedWork: leftoverWork.length === 0,
      cleanedContainers: containersGone,
      blocker: compiled.result.ok ? failed.result.blocker : compiled.result.blocker,
    });
    process.exit(ok ? 0 : 1);
  } catch (error) {
    report({
      ok: false,
      phase: 'compile-fixture',
      reason: error instanceof Error ? error.message : 'Packaged worker compile fixture failed.',
    });
    process.exit(1);
  }
}

if (healthOnly) {
  report({
    ok: health.ready,
    phase: 'health',
    state: health.state,
    mode: health.mode,
    isolation: health.isolation,
    worker: health.workerId,
    processId: health.processId,
    missing: health.missing,
    schema: evidence.schemaClassification,
    workRoot: evidence.workRoot,
    generation: {
      mode: generation.mode,
      permitted: generation.permitted,
      production: generation.production,
      founderPilot: generation.founderPilot,
      generationReady: generation.generationReady,
      missing: generation.missing,
    },
  });
  process.exit(health.ready ? 0 : 2);
}

const workRootBlocked = Boolean(
  process.env.ARCHITECT_APPS_WORK_ROOT?.trim() && evidence.workRoot && 'ok' in evidence.workRoot && !evidence.workRoot.ok,
);

if (
  !appsWorkerAuthorized(process.env, evidence) ||
  !generation.permitted ||
  !appsControlPlaneReady() ||
  hostedWorkerPlaneForbidden() ||
  workRootBlocked ||
  (appsDeploymentMode() === 'commissioned' && !commissionedAppsWorkerReady(process.env, evidence))
) {
  console.error(
    sanitizeLog(
      `Apps worker refused: ${health.state}. Missing ${missing.join(', ') || 'authorization'}. Requires matching NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, server-only SUPABASE_SERVICE_ROLE_KEY, ARCHITECT_ORIGIN_ENABLED, ARCHITECT_APPS_ENABLED, and ARCHITECT_CONSTRUCT_WORKER_TOKEN (>=32) on a non-Vercel host. Production-capable execution also needs ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned, ARCHITECT_APPS_REQUIRE_ISOLATION=true, and a pinned ARCHITECT_APPS_IMAGE_DIGEST. Do not disguise a production worker as local or run it on Vercel. Values are not printed.`,
    ),
  );
  report({
    ok: false,
    phase: 'preflight',
    state: health.state,
    mode: health.mode,
    missing,
    processId: identity.processId,
    digest: parseAppsImageDigest(process.env.ARCHITECT_APPS_IMAGE_DIGEST) ? 'present' : 'missing',
    observedDigest: evidence.observedDigest ? 'present' : 'missing',
    schema: evidence.schemaClassification,
    schemaMissing: evidence.schemaMissing,
    workRoot: evidence.workRoot,
    generation: {
      mode: generation.mode,
      permitted: generation.permitted,
      production: generation.production,
      founderPilot: generation.founderPilot,
      generationReady: generation.generationReady,
      missing: generation.missing,
    },
  });
  process.exit(2);
}

if (preflight) {
  await reportWorkerPresence(health, evidence);
  report({
    ok: true,
    phase: 'preflight',
    state: 'idle',
    mode: health.mode,
    isolation: evidence.isolation.available ? 'docker' : 'unavailable',
    worker: appsWorkerIdentity(),
    processId: identity.processId,
    digest: 'matched',
    missing: [],
    schema: evidence.schemaClassification,
    workRoot: evidence.workRoot,
    generation: {
      mode: generation.mode,
      permitted: generation.permitted,
      production: generation.production,
      founderPilot: generation.founderPilot,
      generationReady: generation.generationReady,
      missing: generation.missing,
    },
  });
  process.exit(0);
}

const healthPort = Number(process.env.ARCHITECT_APPS_WORKER_HEALTH_PORT ?? 0);
let busy = false;
if (Number.isInteger(healthPort) && healthPort > 0) {
  const server = createServer((_request, response) => {
    const current = classifyAppsWorkerHealth({
      env: process.env,
      busy,
      isolationAvailable: evidence.isolationAvailable,
      observedDigest: evidence.observedDigest,
      schemaCompatible: evidence.schemaCompatible,
    });
    response.writeHead(current.ready ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(
      sanitizeLog(
        JSON.stringify({
          ok: current.ready,
          state: current.state,
          mode: current.mode,
          isolation: current.isolation,
          worker: current.workerId,
          processId: current.processId,
          missing: current.missing,
          generation: {
            mode: current.generation.mode,
            permitted: current.generation.permitted,
            production: current.generation.production,
            founderPilot: current.generation.founderPilot,
            generationReady: current.generation.generationReady,
          },
        }),
      ),
    );
  });
  server.listen(healthPort, '127.0.0.1');
}

try {
  const store = createWorkerAppStore();
  const workerId = appsWorkerIdentity();
  if (supervised) {
    const shutdown = new AbortController();
    const stop = () => {
      console.error('apps-worker: shutdown signal received');
      shutdown.abort();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const result = await superviseAppsWorker({
      store,
      workerId,
      signal: shutdown.signal,
      onTick: (job) => {
        busy = Boolean(job && (job.status === 'queued' || job.status === 'running'));
        void reportWorkerPresence(
          classifyAppsWorkerHealth({
            env: process.env,
            busy,
            isolationAvailable: evidence.isolationAvailable,
            observedDigest: evidence.observedDigest,
            schemaCompatible: evidence.schemaCompatible,
          }),
          evidence,
        );
      },
    });
    report({
      ok: true,
      phase: 'supervised-shutdown',
      appJob: null,
      appStatus: 'idle',
      isolation: null,
      sandbox: false,
      blocker: null,
      worker: result.workerId,
      ticks: result.ticks,
      processId: identity.processId,
    });
  } else {
    console.error('apps-worker: starting');
    await reportWorkerPresence(health, evidence);
    busy = true;
    const appJob = await processAppBuildOnce(store, workerId);
    busy = false;
    report({
      ok: true,
      phase: appJob ? 'executed' : 'idle',
      appJob: appJob?.id ?? null,
      appStatus: appJob?.status ?? 'idle',
      appIsolation: appJob?.result?.isolation ?? null,
      appSandbox: appJob?.result?.sandbox ?? false,
      blocker: appJob?.result?.blocker ?? null,
      worker: workerId,
      processId: identity.processId,
    });
    console.error('apps-worker: shutdown');
  }
} catch (error) {
  console.error(
    sanitizeLog(`Apps worker tick failed: ${error instanceof Error ? error.message : 'unavailable'}`),
  );
  process.exit(1);
}
