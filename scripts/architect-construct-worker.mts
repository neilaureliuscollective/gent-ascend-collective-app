import { constructWorkerAuthorized } from '../src/domains/architect-construct/readiness.ts';
import { createWorkerConstructStore } from '../src/domains/architect-construct/database-store.ts';
import { processConstructOnce } from '../src/domains/architect-construct/worker.ts';

if (!constructWorkerAuthorized()) {
  console.error(
    'Construct worker refused: requires local ARCHITECT_ORIGIN_ENABLED, ARCHITECT_CONSTRUCT_ENABLED, and ARCHITECT_CONSTRUCT_WORKER_TOKEN (>=32). Production and hosted runtimes stay closed.',
  );
  process.exit(2);
}
try {
  const store = createWorkerConstructStore();
  const workerId = process.env.ARCHITECT_CONSTRUCT_WORKER_ID || 'construct-worker';
  const run = await processConstructOnce(store, workerId);
  console.log(JSON.stringify({ ok: true, run: run?.id ?? null, status: run?.status ?? 'idle' }));
} catch (error) {
  console.error(
    `Construct worker tick failed: ${error instanceof Error ? error.message : 'unavailable'}`,
  );
  process.exit(1);
}
