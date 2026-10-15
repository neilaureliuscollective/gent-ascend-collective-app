export const RENDER_LIMITS = {
  downloadMs: 30_000,
  probeMs: 20_000,
  pngMs: 20_000,
  coverMs: 15_000,
  renderMs: 90_000,
  jobMs: 180_000,
  maxInputBytes: 80 * 1024 * 1024,
  maxTempBytes: 256 * 1024 * 1024,
  maxAssets: 24,
  queueFreshMs: 60_000,
} as const;

export class TempBudget {
  used = 0;
  constructor(readonly limit = RENDER_LIMITS.maxTempBytes) {}
  add(bytes: number) {
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error('Invalid render size.');
    if (bytes > RENDER_LIMITS.maxInputBytes)
      throw new Error('A Studio asset exceeds the input size limit.');
    this.used += bytes;
    if (this.used > this.limit) throw new Error('Studio render exceeded the temporary disk limit.');
  }
}

export function remainingMs(deadlineAt: number, fallback: number = RENDER_LIMITS.renderMs) {
  return Math.max(1, Math.min(fallback, deadlineAt - Date.now()));
}

export function jobDeadlineAt(now = Date.now()) {
  return now + RENDER_LIMITS.jobMs;
}
