import { spawn, type ChildProcess } from 'node:child_process';

export function killProcessTree(child: ChildProcess) {
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch {
      /* process group may already be gone */
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    /* already exited */
  }
}

export function runCommand(
  command: string,
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal } = { timeoutMs: 20_000 },
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error('Studio render was cancelled.'));
      return;
    }
    const child = spawn(/* turbopackIgnore: true */ command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (error) {
        killProcessTree(child);
        reject(error);
      }
    };
    const timer = setTimeout(
      () => finish(new Error('Studio render exceeded the time limit.')),
      options.timeoutMs,
    );
    const onAbort = () => finish(new Error('Studio render was cancelled.'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout?.on('data', (chunk) => out.push(chunk as Buffer));
    child.stderr?.on('data', (chunk) => err.push(chunk as Buffer));
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.slice(0, 500) || `Command failed (${code})`));
    });
  });
}

export function combineAbortSignals(signals: AbortSignal[]) {
  const live = signals.filter(Boolean);
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function' && live.length)
    return AbortSignal.any(live);
  const controller = new AbortController();
  for (const signal of live) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
