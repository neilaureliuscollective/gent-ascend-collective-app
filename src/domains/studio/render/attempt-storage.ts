export function attemptObjectKeys(input: {
  uid: string;
  projectId: string;
  jobId: string;
  token: string;
}) {
  const prefix = `${input.uid}/${input.projectId}/${input.jobId}/${input.token}`;
  return {
    prefix,
    film: `${prefix}/film.mp4`,
    cover: `${prefix}/cover.png`,
    captions: `${prefix}/captions.vtt`,
  };
}

export function publishedStorageKeys(row: {
  storage_film?: string | null;
  storage_cover?: string | null;
  storage_captions?: string | null;
} | null) {
  return new Set(
    [row?.storage_film, row?.storage_cover, row?.storage_captions].filter((key): key is string => Boolean(key)),
  );
}

export async function cleanupAttemptObjects(
  remove: (keys: string[]) => Promise<unknown>,
  uploaded: string[],
  keep: Set<string>,
) {
  const stale = uploaded.filter((key) => !keep.has(key));
  if (stale.length) await remove(stale);
  return stale;
}

export type FinishReceipt = { error: unknown; data: unknown };
export type JobSnapshot = {
  status: string;
  lease_token: string | null;
  storage_film: string | null;
  storage_cover: string | null;
  storage_captions: string | null;
};
export type JobRead =
  | { available: true; row: JobSnapshot | null }
  | { available: false; reason: string };

async function readDurableJob(readJob: () => Promise<JobRead>) {
  let lastUnavailable: JobRead | null = null;
  let lastAvailable: Extract<JobRead, { available: true }> | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const read = await readJob();
    if (!read.available) {
      lastUnavailable = read;
    } else {
      lastAvailable = read;
      if (read.row?.status && read.row.status !== 'running') return read;
    }
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
  }
  if (lastAvailable) return lastAvailable;
  return lastUnavailable ?? { available: false as const, reason: 'Job state could not be read.' };
}

/** Reconcile durable job state before deleting anything after an uncertain finish. */
export async function publishOrReconcileAttempt(input: {
  finish: () => Promise<FinishReceipt>;
  readJob: () => Promise<JobRead>;
  uploaded: string[];
  remove: (keys: string[]) => Promise<unknown>;
  token?: string;
}) {
  const finished = await input.finish();
  if (!finished.error && finished.data)
    return { published: true, ours: true, reconciled: false, uncertain: false };
  const read = await readDurableJob(input.readJob);
  if (!read.available) {
    return { published: false, ours: false, reconciled: false, uncertain: true };
  }
  const row = read.row;
  const keep = publishedStorageKeys(row);
  if (row?.status === 'complete') {
    await cleanupAttemptObjects(input.remove, input.uploaded, keep);
    const ours = input.uploaded.length > 0 && input.uploaded.every((key) => keep.has(key));
    return { published: ours, ours, reconciled: true, uncertain: false };
  }
  if (row?.status === 'running' && input.token && row.lease_token === input.token) {
    return { published: false, ours: false, reconciled: true, uncertain: true };
  }
  await cleanupAttemptObjects(input.remove, input.uploaded, keep);
  return { published: false, ours: false, reconciled: true, uncertain: false };
}

export const IDLE_POLL_MS = 2000;
export const RECOVER_EVERY_IDLE_TICKS = 5;

export function shouldRecoverWhileIdle(idleTicks: number) {
  return idleTicks > 0 && idleTicks % RECOVER_EVERY_IDLE_TICKS === 0;
}

export function queueErrorBackoffMs(failures: number) {
  return Math.min(30_000, 1000 * 2 ** Math.min(5, Math.max(0, failures)));
}
