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
import { inspectAppsImageDigest, parseAppsImageDigest, probeAppsDockerIsolation } from './isolate';
import { appsControlPlaneReady } from './readiness';
import { superviseAppsWorker } from './supervisor';
import { processAppBuildOnce } from './worker';

function report(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
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
  return {
    isolationAvailable: isolation.available,
    observedDigest,
    schemaCompatible,
    schemaClassification,
    schemaMissing,
    isolation,
  };
}

const preflight = process.argv.includes('--preflight');
const healthOnly = process.argv.includes('--health');
const supervised =
  process.env.ARCHITECT_APPS_WORKER_MODE === 'supervised' ||
  process.env.ARCHITECT_CONSTRUCT_WORKER_MODE === 'supervised' ||
  process.argv.includes('--supervised');

const evidence = await gatherEvidence();
const health = classifyAppsWorkerHealth({
  env: process.env,
  isolationAvailable: evidence.isolationAvailable,
  observedDigest: evidence.observedDigest,
  schemaCompatible: evidence.schemaCompatible,
});
const missing = appsWorkerMissingNames();
const identity = appsProcessIdentity();

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
  });
  process.exit(health.ready ? 0 : 2);
}

if (
  !appsWorkerAuthorized(process.env, evidence) ||
  !appsControlPlaneReady() ||
  hostedWorkerPlaneForbidden() ||
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
  });
  process.exit(2);
}

if (preflight) {
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
