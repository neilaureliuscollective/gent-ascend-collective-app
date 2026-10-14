import {
  constructWorkerAuthorized,
  constructWorkerControlPlaneReady,
  constructWorkerMissingNames,
} from '@/domains/architect-construct/readiness';
import { createWorkerConstructStore } from '@/domains/architect-construct/database-store';
import { superviseConstructWorker } from '@/domains/architect-construct/supervisor';
import { constructWorkerIdentity, processConstructOnce } from '@/domains/architect-construct/worker';

const missing = constructWorkerMissingNames();
if (!constructWorkerAuthorized() || !constructWorkerControlPlaneReady()) {
  console.error(
    `Construct worker refused: missing ${missing.join(', ') || 'authorization'}. Requires matching NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, server-only SUPABASE_SERVICE_ROLE_KEY, ARCHITECT_ORIGIN_ENABLED, ARCHITECT_CONSTRUCT_ENABLED, and ARCHITECT_CONSTRUCT_WORKER_TOKEN (>=32) on a non-Vercel host. Production and hosted runtimes stay closed. Do not disguise a production worker as development. Values are not printed.`,
  );
  process.exit(2);
}

const supervised =
  process.env.ARCHITECT_CONSTRUCT_WORKER_MODE === 'supervised' ||
  process.argv.includes('--supervised');

try {
  const store = createWorkerConstructStore();
  const workerId = constructWorkerIdentity();
  if (supervised) {
    const shutdown = new AbortController();
    const stop = () => {
      console.error('construct-worker: shutdown signal received');
      shutdown.abort();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const result = await superviseConstructWorker({
      store,
      workerId,
      signal: shutdown.signal,
    });
    console.log(
      JSON.stringify({
        ok: true,
        phase: 'supervised-shutdown',
        run: null,
        status: 'idle',
        isolation: null,
        sandbox: false,
        blocker: null,
        worker: result.workerId,
        ticks: result.ticks,
      }),
    );
  } else {
    console.error('construct-worker: starting');
    const run = await processConstructOnce(store, workerId);
    console.log(
      JSON.stringify({
        ok: true,
        phase: run ? 'executed' : 'idle',
        run: run?.id ?? null,
        status: run?.status ?? 'idle',
        isolation: run?.result?.isolation ?? null,
        sandbox: run?.result?.sandbox ?? false,
        blocker: run?.result?.blocker ?? null,
        worker: workerId,
      }),
    );
    console.error('construct-worker: shutdown');
  }
} catch (error) {
  console.error(
    `Construct worker tick failed: ${error instanceof Error ? error.message : 'unavailable'}`,
  );
  process.exit(1);
}
