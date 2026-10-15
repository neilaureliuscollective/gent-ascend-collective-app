import { chmodSync, chownSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function appsWorkRoot(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const root = env.ARCHITECT_APPS_WORK_ROOT?.trim();
  if (!root) return tmpdir();
  if (!root.startsWith('/') || root.includes('..') || root.includes('docker.sock') || root.includes('\\'))
    throw new Error('ARCHITECT_APPS_WORK_ROOT must be an absolute shared host path without privileged mounts.');
  return root;
}

export function assertHostVisibleWorkPath(
  path: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const root = env.ARCHITECT_APPS_WORK_ROOT?.trim();
  if (!root) return path;
  const prefix = root.endsWith('/') ? root : `${root}/`;
  if (path !== root && !path.startsWith(prefix))
    throw new Error(
      'Isolated work path is not under the shared host work root. Sibling Docker mounts the host path, not a path that exists only inside the worker container.',
    );
  return path;
}

export const appsWorkUser = {
  uid: 1000,
  gid: 1000,
  mode: 0o0755,
  sharedMode: 0o2775,
} as const;

export type AppsWorkRootClassification =
  | { ok: true; code: 'ready'; reason: null; uid: number; gid: number; mode: string }
  | { ok: false; code: 'missing' | 'world-writable' | 'owner-mismatch' | 'not-writable' | 'error'; reason: string; uid?: number; gid?: number; mode?: string };

function describeMode(mode: number) {
  return (mode & 0o777).toString(8).padStart(3, '0');
}

export function classifyAppsWorkRoot(
  stat: { uid: number; gid: number; mode: number },
  expected = appsWorkUser,
): AppsWorkRootClassification {
  const mode = describeMode(stat.mode);
  if ((stat.mode & 0o002) !== 0)
    return {
      ok: false,
      code: 'world-writable',
      reason: `Shared work root mode ${mode} is world-writable. Use 0755 owned by uid ${expected.uid}, or 2775 with the Docker socket group. Do not chmod 777.`,
      uid: stat.uid,
      gid: stat.gid,
      mode,
    };
  if (stat.uid !== expected.uid)
    return {
      ok: false,
      code: 'owner-mismatch',
      reason: `Shared work root is owned by uid ${stat.uid}. The packaged worker runs as uid ${expected.uid} and cannot create isolated workspaces in a root- or host-owned directory.`,
      uid: stat.uid,
      gid: stat.gid,
      mode,
    };
  if ((stat.mode & 0o200) === 0)
    return {
      ok: false,
      code: 'not-writable',
      reason: `Shared work root mode ${mode} is not writable by uid ${expected.uid}.`,
      uid: stat.uid,
      gid: stat.gid,
      mode,
    };
  return { ok: true, code: 'ready', reason: null, uid: stat.uid, gid: stat.gid, mode };
}

export function inspectAppsWorkRoot(path: string, expected = appsWorkUser): AppsWorkRootClassification {
  try {
    return classifyAppsWorkRoot(statSync(path), expected);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT')
      return {
        ok: false,
        code: 'missing',
        reason: `Shared work root ${path} does not exist. Create it as uid ${expected.uid} mode 0755, or 2775 with the Docker socket group, before accepting jobs.`,
      };
    return {
      ok: false,
      code: 'error',
      reason: error instanceof Error ? error.message : 'Shared work root could not be inspected.',
    };
  }
}

function tryChown(path: string, uid: number, gid: number, mode: number = appsWorkUser.mode) {
  try {
    chownSync(path, uid, gid);
    chmodSync(path, mode);
    return true;
  } catch {
    const installed = spawnSync(
      'sudo',
      ['-n', 'install', '-d', '-o', String(uid), '-g', String(gid), '-m', (mode & 0o7777).toString(8).padStart(4, '0'), path],
      { encoding: 'utf8' },
    );
    return installed.status === 0;
  }
}

export function prepareAppsWorkRoot(
  path: string,
  expected = appsWorkUser,
  sharedGid?: number,
) {
  if (!path.startsWith('/') || path.includes('..') || path.includes('docker.sock'))
    throw new Error('ARCHITECT_APPS_WORK_ROOT must be an absolute shared host path without privileged mounts.');
  mkdirSync(path, { recursive: true });
  const gid = sharedGid && sharedGid > 0 ? sharedGid : expected.gid;
  const mode = gid !== expected.gid ? expected.sharedMode : expected.mode;
  const current = inspectAppsWorkRoot(path, expected);
  if (!current.ok) {
    if (!tryChown(path, expected.uid, gid, mode))
      throw new Error(
        `${current.reason} Prepare with: sudo install -d -o ${expected.uid} -g ${gid} -m ${(mode & 0o777).toString(8)} ${path}`,
      );
  }
  const ready = inspectAppsWorkRoot(path, expected);
  if (!ready.ok) throw new Error(ready.reason);
  return ready;
}

export function assertAppsWorkRootContract(path: string, expected = appsWorkUser) {
  const inspected = inspectAppsWorkRoot(path, expected);
  if (!inspected.ok) throw new Error(inspected.reason);
  return inspected;
}

export function proveWorkerOwnedWorkspace(path: string, expected = appsWorkUser) {
  const contract = assertAppsWorkRootContract(path, expected);
  const marker = join(path, `.apps-work-owned-${process.pid}`);
  try {
    writeFileSync(marker, 'worker-created\n', { mode: 0o644 });
    const wrote = statSync(marker);
    if (wrote.uid !== expected.uid && process.getuid?.() !== expected.uid)
      throw new Error(`Worker workspace file is owned by uid ${wrote.uid}, not ${expected.uid}.`);
    return { ok: true as const, contract, marker };
  } finally {
    rmSync(marker, { force: true });
  }
}
