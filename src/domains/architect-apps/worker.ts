import { defaultAppLimits, terminalJobStatuses, type AppJob } from './schema';
import { buildGeneratedApp } from './builder';
import { AppStoreError, type AppStore } from './store';

export class AppLeaseLostError extends Error {
  constructor(message = 'Worker lost the lease before a durable result was recorded.') {
    super(message);
  }
}

export async function processAppBuildOnce(
  store: AppStore,
  workerId: string,
  now = new Date(),
  options: { build?: typeof buildGeneratedApp; shouldAbort?: () => boolean } = {},
) {
  await store.recoverTimeouts(now);
  const claimed = await store.claimJob(workerId, now);
  if (!claimed) return null;
  const token = claimed.lease_token;
  if (!token) throw new AppStoreError('Claim did not issue a lease token.');
  const finish = async (status: (typeof terminalJobStatuses)[number], result: NonNullable<AppJob['result']>, when = new Date()) => {
    return store.finishJob(workerId, claimed.id, token, status, result, when);
  };
  if (claimed.cancel_requested) {
    return finish('cancelled', {
      ok: false,
      isolation: 'unavailable',
      sandbox: false,
      typecheck: { ok: false, log: '' },
      bundle: { ok: false, log: '' },
      blocker: 'Owner cancelled the build before execution started.',
      stages: [{ kind: 'cancelled', at: now.toISOString(), detail: 'Cancelled before start.' }],
    });
  }
  if (!(await store.markRunning(workerId, claimed.id, token, now)))
    throw new AppLeaseLostError('Worker lost the lease before the build could start.');
  await store.appendEvent(claimed, 'started', 'Worker started the trusted app-build profile.');
  await store.markRevisionStatus(claimed.person_id, claimed.revision_id, 'building');
  let lost = false;
  const renew = async () => {
    const ok = await store.heartbeat(workerId, claimed.id, token, new Date(), defaultAppLimits.lease_ms);
    if (!ok) lost = true;
    return ok;
  };
  if (!(await renew())) throw new AppLeaseLostError();
  const interval = setInterval(() => {
    void renew();
  }, 4000);
  try {
    if (options.shouldAbort?.() || claimed.cancel_requested) {
      await store.appendEvent(claimed, 'cancelled', 'Owner cancelled the trusted build.');
      return finish('cancelled', {
        ok: false,
        isolation: 'unavailable',
        sandbox: false,
        typecheck: { ok: false, log: '' },
        bundle: { ok: false, log: '' },
        blocker: 'Owner cancelled the trusted build.',
        stages: [],
      });
    }
    const revision = await store.readRevision(claimed.person_id, claimed.revision_id);
    if (!revision || revision.approval_hash !== claimed.approval_hash)
      throw new AppStoreError('Approved revision is no longer bound to this build.');
    const built = await (options.build ?? buildGeneratedApp)(revision.files, {
      onStage: async (kind, detail) => {
        if (lost) throw new AppLeaseLostError();
        await store.appendEvent(claimed, kind, detail);
      },
    });
    if (lost) throw new AppLeaseLostError();
    if (built.result.ok && built.artifacts.length && built.manifestHash) {
      await store.saveArtifact({
        revision_id: revision.id,
        person_id: claimed.person_id,
        project_id: claimed.project_id,
        manifest_hash: built.manifestHash,
        files: built.artifacts,
        created_at: new Date().toISOString(),
      });
      await store.markRevisionStatus(claimed.person_id, revision.id, 'ready', true);
      await store.appendEvent(claimed, 'preview', 'Compiled artifacts bound to this revision.');
      return finish('succeeded', built.result);
    }
    await store.markRevisionStatus(claimed.person_id, revision.id, 'failed');
    await store.appendEvent(claimed, 'failed', built.result.blocker ?? 'Trusted build failed.');
    return finish('failed', built.result);
  } finally {
    clearInterval(interval);
  }
}
