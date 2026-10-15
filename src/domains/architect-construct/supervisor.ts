import { processAppBuildOnce } from '@/domains/architect-apps/worker';
import type { AppStore } from '@/domains/architect-apps/store';
import { constructWorkerIdentity, processConstructOnce } from './worker';
import type { ExecuteOptions } from './runner';
import type { ConstructRun } from './schema';
import type { ConstructStore } from './store';

export type SupervisorOptions = {
  store: ConstructStore;
  workerId?: string;
  signal: AbortSignal;
  idleMs?: number;
  maxBackoffMs?: number;
  now?: () => Date;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  execute?: ExecuteOptions;
  appStore?: AppStore;
  onTick?: (run: ConstructRun | null, workerId: string) => void;
  onError?: (error: unknown) => void;
};

export const DEFAULT_IDLE_MS = 1500;
export const DEFAULT_MAX_BACKOFF_MS = 15000;

export function supervisorBackoff(idleMs: number, failures: number, maxBackoffMs: number) {
  const exp = Math.min(maxBackoffMs, idleMs * 2 ** Math.min(failures, 6));
  return Math.max(idleMs, exp);
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

/**
 * Supervised external-worker loop. Compatible with the durable queue and isolated
 * execution. Does not run inside Vercel request handlers.
 */
export async function superviseConstructWorker(options: SupervisorOptions) {
  const workerId = options.workerId ?? constructWorkerIdentity();
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const sleep = options.sleep ?? sleepWithSignal;
  const now = options.now ?? (() => new Date());
  let failures = 0;
  let ticks = 0;
  console.error(`construct-worker: supervised start ${workerId}`);
  try {
    while (!options.signal.aborted) {
      try {
        const run = await processConstructOnce(options.store, workerId, now(), {
          ...(options.execute ?? {}),
          shouldAbort: () => options.signal.aborted || Boolean(options.execute?.shouldAbort?.()),
        });
        if (options.appStore) {
          await processAppBuildOnce(options.appStore, workerId, now(), {
            shouldAbort: () => options.signal.aborted,
          });
        }
        options.onTick?.(run, workerId);
        ticks += 1;
        failures = 0;
        if (!run) await sleep(idleMs, options.signal);
      } catch (error) {
        failures += 1;
        options.onError?.(error);
        console.error(
          `construct-worker: tick failed (${failures}): ${
            error instanceof Error ? error.message : 'unavailable'
          }`,
        );
        await sleep(supervisorBackoff(idleMs, failures, maxBackoffMs), options.signal);
      }
    }
  } finally {
    console.error(`construct-worker: supervised shutdown ${workerId} after ${ticks} ticks`);
  }
  return { workerId, ticks };
}
