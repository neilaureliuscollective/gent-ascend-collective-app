import { runResultSchema, type RunResult } from './schema';

export const RESULT_RECEIPT_MAX_BYTES = 120000;
export const RESULT_RECEIPT_SAFETY_BYTES = 2048;
export const RESULT_RECEIPT_BUDGET_BYTES = RESULT_RECEIPT_MAX_BYTES - RESULT_RECEIPT_SAFETY_BYTES;
export const RECEIPT_LOG_TRUNCATION =
  '\n/* Architect truncated this log to fit the durable receipt. Status and identity are preserved. */\n';

export function serializedReceiptBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function truncateUtf8(value: string, maxBytes: number) {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maxBytes) return value;
  let end = Math.max(0, maxBytes);
  while (end > 0 && ((encoded[end] ?? 0) & 0b11000000) === 0b10000000) end -= 1;
  return new TextDecoder().decode(encoded.slice(0, end));
}

function withTruncationMark(value: string, maxBytes: number) {
  const markBytes = new TextEncoder().encode(RECEIPT_LOG_TRUNCATION).byteLength;
  const room = Math.max(0, maxBytes - markBytes);
  return `${truncateUtf8(value, room)}${RECEIPT_LOG_TRUNCATION}`;
}

const CHECK_LOG_CHAR_MAX = 16384;
const DIFF_CHAR_MAX = 65536;
const PREVIEW_CHAR_MAX = 32768;

function clampField(value: string, charMax: number) {
  if (value.length <= charMax) return value;
  const mark = RECEIPT_LOG_TRUNCATION;
  const room = Math.max(0, charMax - mark.length);
  return `${value.slice(0, room)}${mark}`;
}

function clampResultForSchema(result: RunResult): RunResult {
  const next = structuredClone(result);
  for (const set of [next.checks, next.baseline_checks ?? []]) {
    for (const check of set) check.log = clampField(check.log, CHECK_LOG_CHAR_MAX);
  }
  next.diff = clampField(next.diff, DIFF_CHAR_MAX);
  if (next.preview.body.length > PREVIEW_CHAR_MAX) {
    next.preview = {
      ...next.preview,
      body: clampField(next.preview.body, PREVIEW_CHAR_MAX),
      unavailable_reason:
        next.preview.unavailable_reason ??
        'Preview body was truncated to fit the durable receipt. This is not a running application.',
    };
  }
  if (next.blocker && next.blocker.length > 400) next.blocker = next.blocker.slice(0, 400);
  return next;
}

function shrinkCheckLogs(result: RunResult, logBudget: number): RunResult {
  const next = structuredClone(result);
  const sets = [next.checks, next.baseline_checks ?? []];
  for (const set of sets) {
    for (const check of set) {
      if (serializedReceiptBytes(check.log) <= logBudget) continue;
      const previousStatus = check.status;
      check.log = withTruncationMark(check.log, logBudget);
      check.status = previousStatus;
    }
  }
  return next;
}

function shrinkTextField<K extends 'diff'>(result: RunResult, key: K, budget: number): RunResult {
  const next = structuredClone(result);
  if (serializedReceiptBytes(next[key]) > budget) next[key] = withTruncationMark(next[key], budget);
  return next;
}

function shrinkPreview(result: RunResult, budget: number): RunResult {
  const next = structuredClone(result);
  if (serializedReceiptBytes(next.preview.body) <= budget) return next;
  next.preview = {
    ...next.preview,
    body: withTruncationMark(next.preview.body, budget),
    unavailable_reason:
      next.preview.unavailable_reason ??
      'Preview body was truncated to fit the durable receipt. This is not a running application.',
  };
  return next;
}

export function boundRunResult(result: RunResult, maxBytes = RESULT_RECEIPT_BUDGET_BYTES): RunResult {
  let next = runResultSchema.parse(clampResultForSchema(result));
  if (serializedReceiptBytes(next) <= maxBytes) return next;
  for (const logBudget of [4096, 1024, 256, 64]) {
    next = shrinkCheckLogs(next, logBudget);
    if (serializedReceiptBytes(next) <= maxBytes) return runResultSchema.parse(next);
  }
  next = shrinkTextField(next, 'diff', 2048);
  if (serializedReceiptBytes(next) <= maxBytes) return runResultSchema.parse(next);
  next = shrinkPreview(next, 1024);
  if (serializedReceiptBytes(next) <= maxBytes) return runResultSchema.parse(next);
  next = {
    ...next,
    diff: withTruncationMark(next.diff, 256),
    preview: {
      ...next.preview,
      body: '',
      unavailable_reason:
        'Preview was omitted so the durable receipt could persist. Check identity and status remain.',
    },
    blocker:
      next.blocker ??
      'Receipt content was truncated to the 120000-byte durable limit. Missing preview is not a pass.',
  };
  return runResultSchema.parse(next);
}

export function persistenceRejectedResult(result: RunResult, reason: string): RunResult {
  return boundRunResult({
    ...result,
    sandbox: false,
    result_hash: result.result_hash,
    blocker: `${reason} The run is not reported successful. Truncated evidence is not a pass.`,
    coverage: result.coverage
      ? {
          ...result.coverage,
          revision_note: `${result.coverage.revision_note} Receipt persistence required truncation.`,
        }
      : result.coverage,
  });
}
