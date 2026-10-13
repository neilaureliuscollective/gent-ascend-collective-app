import { constructWorkerAuthorized } from '../src/domains/architect-construct/readiness.ts';

const origin = process.env.ARCHITECT_CONSTRUCT_WORKER_ORIGIN ?? 'http://127.0.0.1:3000';
if (!constructWorkerAuthorized()) {
  console.error(
    'Construct worker refused: requires local ARCHITECT_ORIGIN_ENABLED, ARCHITECT_CONSTRUCT_ENABLED, and ARCHITECT_CONSTRUCT_WORKER_TOKEN (>=32). Production and hosted runtimes stay closed.',
  );
  process.exit(2);
}
const token = process.env.ARCHITECT_CONSTRUCT_WORKER_TOKEN!;
const response = await fetch(new URL('/api/internal/architect-construct', origin), {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok) {
  console.error(`Construct worker tick failed: ${response.status}`);
  process.exit(1);
}
const body = await response.json();
console.log(JSON.stringify({ ok: true, run: body.run?.id ?? null, status: body.run?.status ?? 'idle' }));
