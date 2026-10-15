export const APP_ACCEPTANCE_MODEL = 'gpt-6-astra';
export const APP_ACCEPTANCE_CONTEXT_TIER = 'short' as const;
export const APP_ACCEPTANCE_SHORT_CONTEXT_MAX = 272000;

/** Official standard short-context list prices per 1M tokens, inspected 2026-10-15. */
export const APP_ACCEPTANCE_PRICING = {
  model: APP_ACCEPTANCE_MODEL,
  inspected: '2026-10-15',
  source: 'https://developers.openai.com/api/docs/pricing',
  tier: APP_ACCEPTANCE_CONTEXT_TIER,
  shortContextMaxInput: APP_ACCEPTANCE_SHORT_CONTEXT_MAX,
  inputMicrosPerToken: 10,
  outputMicrosPerToken: 50,
} as const;

export const APP_ACCEPTANCE_BUDGET = {
  maxCalls: 2,
  maxInputTokens: 16000,
  maxOutputTokens: 4000,
  maxMicros: 1_000_000,
  heartbeatMaxAgeMs: 90_000,
} as const;

export type AppGenerationCallStatus = 'reserved' | 'completed' | 'failed' | 'uncertain' | 'cancelled';

export type AppGenerationReservation = {
  requestId: string;
  runId: string;
  personId: string;
  status: AppGenerationCallStatus;
  reservedInput: number;
  reservedOutput: number;
  reservedMicros: number;
  usedInput: number | null;
  usedOutput: number | null;
  usedMicros: number | null;
};

export type AppBudgetReserveResult = {
  created: boolean;
  reservation: AppGenerationReservation;
};

export type AppBudgetStore = {
  reserve(input: {
    requestId: string;
    runId: string;
    personId: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<AppBudgetReserveResult>;
  finish(input: {
    requestId: string;
    personId: string;
    status: Exclude<AppGenerationCallStatus, 'reserved'>;
    usedInput?: number | null;
    usedOutput?: number | null;
  }): Promise<AppGenerationReservation>;
  list(runId: string, personId: string): Promise<AppGenerationReservation[]>;
};

export function asAppGenerationReservation(row: unknown): AppGenerationReservation | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const requestId = String(record.request_id ?? record.requestId ?? '');
  const runId = String(record.run_id ?? record.runId ?? '');
  const personId = String(record.person_id ?? record.personId ?? '');
  const status = String(record.status ?? '');
  if (!requestId || !runId || !personId) return null;
  if (!['reserved', 'completed', 'failed', 'uncertain', 'cancelled'].includes(status)) return null;
  return {
    requestId,
    runId,
    personId,
    status: status as AppGenerationCallStatus,
    reservedInput: Number(record.reserved_input ?? record.reservedInput ?? 0),
    reservedOutput: Number(record.reserved_output ?? record.reservedOutput ?? 0),
    reservedMicros: Number(record.reserved_micros ?? record.reservedMicros ?? 0),
    usedInput: record.used_input == null && record.usedInput == null ? null : Number(record.used_input ?? record.usedInput),
    usedOutput: record.used_output == null && record.usedOutput == null ? null : Number(record.used_output ?? record.usedOutput),
    usedMicros: record.used_micros == null && record.usedMicros == null ? null : Number(record.used_micros ?? record.usedMicros),
  };
}

const memory = new Map<string, AppGenerationReservation>();
let lock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => T | Promise<T>) {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function estimateAppGenerationTokens(payload: unknown) {
  const chars = JSON.stringify(payload ?? '').length;
  return Math.max(1, Math.ceil(chars / 4));
}

export function reservedCallMicros(inputTokens: number, outputTokens: number) {
  return inputTokens * APP_ACCEPTANCE_PRICING.inputMicrosPerToken + outputTokens * APP_ACCEPTANCE_PRICING.outputMicrosPerToken;
}

export function resetAppBudgetMemory() {
  memory.clear();
}

export function memoryAppBudgetStore(): AppBudgetStore {
  return {
    async reserve(input) {
      return withLock(() => {
        const existing = memory.get(input.requestId);
        if (existing) {
          if (existing.personId !== input.personId || existing.runId !== input.runId)
            throw new Error('Generation reservation no longer matches this request.');
          return { created: false, reservation: existing };
        }
        if (input.inputTokens > APP_ACCEPTANCE_BUDGET.maxInputTokens)
          throw new Error(
            `Generation input exceeds the ${APP_ACCEPTANCE_BUDGET.maxInputTokens}-token acceptance ceiling.`,
          );
        if (input.outputTokens > APP_ACCEPTANCE_BUDGET.maxOutputTokens)
          throw new Error(
            `Generation output exceeds the ${APP_ACCEPTANCE_BUDGET.maxOutputTokens}-token acceptance ceiling.`,
          );
        const micros = reservedCallMicros(input.inputTokens, input.outputTokens);
        const run = [...memory.values()].filter((row) => row.runId === input.runId && row.personId === input.personId);
        const counted = run.filter((row) => row.status !== 'cancelled');
        if (counted.length >= APP_ACCEPTANCE_BUDGET.maxCalls)
          throw new Error('The founder-pilot acceptance run already reserved its two model calls.');
        const used = counted.reduce((sum, row) => sum + (row.usedMicros ?? row.reservedMicros), 0);
        if (used + micros > APP_ACCEPTANCE_BUDGET.maxMicros)
          throw new Error('The founder-pilot acceptance run would exceed its $1.00 reserved budget.');
        const reserved: AppGenerationReservation = {
          requestId: input.requestId,
          runId: input.runId,
          personId: input.personId,
          status: 'reserved',
          reservedInput: input.inputTokens,
          reservedOutput: input.outputTokens,
          reservedMicros: micros,
          usedInput: null,
          usedOutput: null,
          usedMicros: null,
        };
        memory.set(input.requestId, reserved);
        return { created: true, reservation: reserved };
      });
    },
    async finish(input) {
      return withLock(() => {
        const existing = memory.get(input.requestId);
        if (!existing || existing.personId !== input.personId)
          throw new Error('Generation reservation is unavailable.');
        if (existing.status !== 'reserved' && existing.status !== 'uncertain') return existing;
        const usedInput =
          input.status === 'cancelled'
            ? 0
            : Math.max(input.usedInput ?? existing.reservedInput, input.status === 'uncertain' ? existing.reservedInput : 0);
        const usedOutput =
          input.status === 'cancelled'
            ? 0
            : Math.max(input.usedOutput ?? existing.reservedOutput, input.status === 'uncertain' ? existing.reservedOutput : 0);
        const next: AppGenerationReservation = {
          ...existing,
          status: input.status,
          usedInput: input.status === 'cancelled' ? 0 : usedInput,
          usedOutput: input.status === 'cancelled' ? 0 : usedOutput,
          usedMicros: input.status === 'cancelled' ? 0 : reservedCallMicros(usedInput, usedOutput),
        };
        memory.set(input.requestId, next);
        return next;
      });
    },
    async list(runId, personId) {
      return [...memory.values()].filter((row) => row.runId === runId && row.personId === personId);
    },
  };
}

export type AppBudgetClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function databaseAppBudgetStore(client: AppBudgetClient): AppBudgetStore {
  return {
    async reserve(input) {
      const saved = await client.rpc('architect_apps_reserve_generation', {
        p_request: input.requestId,
        p_run: input.runId,
        p_input: input.inputTokens,
        p_output: input.outputTokens,
      });
      if (saved.error) throw new Error(saved.error.message);
      const payload = saved.data && typeof saved.data === 'object' ? (saved.data as Record<string, unknown>) : null;
      const reservation = asAppGenerationReservation(payload);
      if (!reservation) throw new Error('Generation reservation is unavailable.');
      return { created: payload?.created === true, reservation };
    },
    async finish(input) {
      const saved = await client.rpc('architect_apps_finish_generation', {
        p_request: input.requestId,
        p_status: input.status,
        p_input: input.usedInput ?? null,
        p_output: input.usedOutput ?? null,
      });
      if (saved.error) throw new Error(saved.error.message);
      const reservation = asAppGenerationReservation(saved.data);
      if (!reservation) throw new Error('Generation reservation is unavailable.');
      return reservation;
    },
    async list() {
      throw new Error('Database generation receipts are read through owner select, not a list RPC.');
    },
  };
}

export const defaultAppBudgetStore = memoryAppBudgetStore;
