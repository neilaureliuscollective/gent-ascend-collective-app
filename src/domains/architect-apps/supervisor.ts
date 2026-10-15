import { appsWorkerConcurrency, appsWorkerIdentity } from './commission';
import { processAppBuildOnce } from './worker';
import type { AppJob } from './schema';
import type { AppStore } from './store';

export type AppsSupervisorOptions = {
  store: AppStore;
  workerId?: string;
  signal: AbortSignal;
  idleMs?: number;
  maxBackoffMs?: number;
  now?: () => Date;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  onTick?: (job: AppJob | null, workerId: string) => void;
  onError?: (error: unknown) => void;
};

export const APPS_DEFAULT_IDLE_MS = 1500;
export const APPS_DEFAULT_MAX_BACKOFF_MS = 15000;

export function appsSupervisorBackoff(idleMs: number, failures: number, maxBackoffMs: number) {
  return Math.max(idleMs, Math.min(maxBackoffMs, idleMs * 2 ** Math.min(failures, 6)));
}

export async function sleepWithSignal(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms);
    const onAbort = () => finish();
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function superviseAppsWorker(options: AppsSupervisorOptions) {
  const env = options.env ?? process.env;
  const workerId = options.workerId ?? appsWorkerIdentity(env);
  const idleMs = options.idleMs ?? APPS_DEFAULT_IDLE_MS;
  const maxBackoffMs = options.maxBackoffMs ?? APPS_DEFAULT_MAX_BACKOFF_MS;
  const sleep = options.sleep ?? sleepWithSignal;
  const now = options.now ?? (() => new Date());
  const concurrency = appsWorkerConcurrency(env);
  let failures = 0;
  let ticks = 0;
  let busy = false;
  console.error(`apps-worker: supervised start ${workerId} concurrency=${concurrency}`);
  try {
    while (!options.signal.aborted) {
      try {
        busy = true;
        const job = await processAppBuildOnce(options.store, workerId, now(), {
          shouldAbort: () => options.signal.aborted,
          env,
        });
        busy = false;
        options.onTick?.(job, workerId);
        ticks += 1;
        failures = 0;
        if (!job) await sleep(idleMs, options.signal);
      } catch (error) {
        busy = false;
        failures += 1;
        options.onError?.(error);
        console.error(
          `apps-worker: tick failed (${failures}): ${error instanceof Error ? error.message : 'unavailable'}`,
        );
        await sleep(appsSupervisorBackoff(idleMs, failures, maxBackoffMs), options.signal);
      }
    }
  } finally {
    busy = false;
    console.error(`apps-worker: supervised shutdown ${workerId} after ${ticks} ticks`);
  }
  return { workerId, ticks, busy };
}
