import { buildGeneratedApp } from './builder';
import { buildIsolatedGeneratedApp } from './isolate';
import { defaultAppLimits, terminalJobStatuses, type AppJob, type AppJobResult, type AppRevision } from './schema';
import { AppStoreError, type AppStore } from './store';

export class AppLeaseLostError extends Error {
  constructor(message = 'Worker lost the lease before a durable result was recorded.') {
    super(message);
  }
}

export function acceptAppBuildSuccess(
  result: AppJobResult,
  generation: AppRevision['generation'],
): 'isolated' | 'host-fixture' | 'reject' {
  if (result.ok && result.isolation === 'docker' && result.sandbox === true) return 'isolated';
  if (
    result.ok &&
    result.isolation === 'host-fixture' &&
    result.sandbox === false &&
    generation.mode === 'fixture'
  )
    return 'host-fixture';
  return 'reject';
}

export function resolveAppExecutionKind(
  generation: AppRevision['generation'],
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): 'docker' | 'host-fixture' {
  if (generation.mode === 'fixture' && env.ARCHITECT_APPS_ALLOW_HOST_FIXTURE === 'true') return 'host-fixture';
  return 'docker';
}

export async function defaultAppBuild(
  files: Parameters<typeof buildGeneratedApp>[0],
  options: Parameters<typeof buildGeneratedApp>[1] & { kind?: 'docker' | 'host-fixture'; signal?: AbortSignal } = {},
) {
  if ((options.kind ?? 'docker') === 'host-fixture') return buildGeneratedApp(files, options);
  return buildIsolatedGeneratedApp(files, {
    timeoutMs: options.timeoutMs,
    onStage: options.onStage,
    signal: options.signal,
  });
}

function refusedIsolation(result: AppJobResult): AppJobResult {
  return {
    ...result,
    ok: false,
    sandbox: false,
    isolation: result.isolation === 'docker' ? 'docker' : result.isolation === 'host-fixture' ? 'host-fixture' : 'unavailable',
    blocker:
      'Unavailable or non-isolated production runner refused. Host-fixture cannot mark a mock or model-generated app as isolated success.',
  };
}

export async function processAppBuildOnce(
  store: AppStore,
  workerId: string,
  now = new Date(),
  options: {
    build?: typeof defaultAppBuild;
    shouldAbort?: () => boolean;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  } = {},
) {
  await store.recoverTimeouts(now);
  const claimed = await store.claimJob(workerId, now);
  if (!claimed) return null;
  const token = claimed.lease_token;
  if (!token) throw new AppStoreError('Claim did not issue a lease token.');
  const fence = { workerId, jobId: claimed.id, leaseToken: token };
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
  await store.appendEvent(claimed, 'started', 'Worker started the isolated app-build profile.');
  await store.markRevisionStatus(claimed.person_id, claimed.revision_id, 'building', false, fence);
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
      await store.appendEvent(claimed, 'cancelled', 'Owner cancelled the isolated build.');
      return finish('cancelled', {
        ok: false,
        isolation: 'unavailable',
        sandbox: false,
        typecheck: { ok: false, log: '' },
        bundle: { ok: false, log: '' },
        blocker: 'Owner cancelled the isolated build.',
        stages: [],
      });
    }
    const revision = await store.readRevision(claimed.person_id, claimed.revision_id);
    if (!revision || revision.approval_hash !== claimed.approval_hash)
      throw new AppStoreError('Approved revision is no longer bound to this build.');
    const kind = resolveAppExecutionKind(revision.generation, options.env);
    const built = await (options.build ?? defaultAppBuild)(revision.files, {
      kind,
      onStage: async (kindStage, detail) => {
        if (lost) throw new AppLeaseLostError();
        await store.appendEvent(claimed, kindStage, detail);
      },
    });
    if (lost) throw new AppLeaseLostError();
    const acceptance = acceptAppBuildSuccess(built.result, revision.generation);
    if (acceptance !== 'reject' && built.artifacts.length && built.manifestHash) {
      await store.saveArtifact(
        {
          revision_id: revision.id,
          person_id: claimed.person_id,
          project_id: claimed.project_id,
          manifest_hash: built.manifestHash,
          files: built.artifacts,
          created_at: new Date().toISOString(),
        },
        fence,
      );
      await store.markRevisionStatus(claimed.person_id, revision.id, 'ready', true, fence);
      await store.appendEvent(
        claimed,
        'preview',
        acceptance === 'isolated'
          ? 'Isolated compiled artifacts bound to this revision.'
          : 'Host-fixture compiled artifacts bound to this labelled tracker fixture. Not isolated Docker success.',
      );
      return finish('succeeded', built.result);
    }
    const result = acceptance === 'reject' && built.result.ok ? refusedIsolation(built.result) : built.result;
    await store.markRevisionStatus(claimed.person_id, revision.id, 'failed', false, fence);
    await store.appendEvent(claimed, 'failed', result.blocker ?? 'Build failed.');
    return finish('failed', result);
  } finally {
    clearInterval(interval);
  }
}
