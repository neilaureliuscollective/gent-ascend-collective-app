import { parseEnvironment } from '@/platform/environment';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export const APP_GENERATION_LIMITS = {
  instructionMax: 2000,
  maxOutputTokens: 4000,
  timeoutMs: 30000,
  maxRetries: 0,
  compileTimeoutMs: 90000,
  compileMemoryMb: 1024,
  compileCpus: 2,
  compilePids: 128,
} as const;

export const APP_FAILURE_CLASSES = ['model', 'compile', 'worker', 'permission'] as const;
export type AppFailureClass = (typeof APP_FAILURE_CLASSES)[number];
export type AppsGenerationPolicyMode = 'openai' | 'mock' | 'fixture' | 'disabled' | 'refused';

export type AppsGenerationPolicy = {
  mode: AppsGenerationPolicyMode;
  permitted: boolean;
  production: boolean;
  founderPilot: boolean;
  generationReady: boolean;
  missing: string[];
  blockers: string[];
  reason: string;
};

function environmentMode(env: Env): 'local' | 'preview' | 'production' | 'invalid' {
  try {
    return parseEnvironment(env).mode;
  } catch {
    return 'invalid';
  }
}

export function appsFounderPilotConfigured(env: Env = process.env) {
  return env.ARCHITECT_APPS_FOUNDER_PILOT === 'true';
}

export function appsGenerationPolicy(env: Env = process.env): AppsGenerationPolicy {
  const parsed = environmentMode(env);
  const production = parsed === 'production';
  const founderPilot = appsFounderPilotConfigured(env);
  const missing: string[] = [];
  const flagsReady = env.ARCHITECT_ORIGIN_ENABLED === 'true' && env.ARCHITECT_APPS_ENABLED === 'true';
  if (env.ARCHITECT_ORIGIN_ENABLED !== 'true') missing.push('ARCHITECT_ORIGIN_ENABLED');
  if (env.ARCHITECT_APPS_ENABLED !== 'true') missing.push('ARCHITECT_APPS_ENABLED');
  const mockRequested = env.ARCHITECT_APPS_AI_MOCK === 'true';
  const openaiRequested = env.ARCHITECT_APPS_AI_ENABLED === 'true';
  const hasKey = Boolean(env.OPENAI_API_KEY?.trim());

  if (parsed === 'invalid') {
    return {
      mode: 'refused',
      permitted: false,
      production,
      founderPilot,
      generationReady: false,
      missing,
      blockers: ['APP_ENV is missing or unsafe.'],
      reason: 'APP_ENV is missing or unsafe.',
    };
  }

  if (production && mockRequested) {
    return {
      mode: 'refused',
      permitted: false,
      production,
      founderPilot,
      generationReady: false,
      missing: [...missing, 'ARCHITECT_APPS_AI_MOCK'],
      blockers: [
        'Mock generation is confined to labelled local and test environments. Production cannot present mocked output as live AI generation.',
      ],
      reason:
        'Mock generation is confined to labelled local and test environments. Production cannot present mocked output as live AI generation.',
    };
  }

  if (mockRequested && flagsReady && !production) {
    return {
      mode: 'mock',
      permitted: true,
      production,
      founderPilot,
      generationReady: true,
      missing: [],
      blockers: [],
      reason: 'Labelled mocked provider. This is not a paid OpenAI call and not a model-generated application.',
    };
  }

  if (openaiRequested) {
    const blockers: string[] = [];
    const openaiMissing = [...missing];
    if (!hasKey) openaiMissing.push('OPENAI_API_KEY');
    if (production && !founderPilot) {
      openaiMissing.push('ARCHITECT_APPS_FOUNDER_PILOT');
      blockers.push(
        'Production model generation stays off until ARCHITECT_APPS_FOUNDER_PILOT is deliberately commissioned. A funded OpenAI account does not enable this path.',
      );
    }
    if (!flagsReady || openaiMissing.length || blockers.length) {
      return {
        mode: 'disabled',
        permitted: true,
        production,
        founderPilot,
        generationReady: false,
        missing: openaiMissing,
        blockers,
        reason:
          blockers[0] ??
          'App generation stays disabled until ARCHITECT_APPS_ENABLED, ARCHITECT_APPS_AI_ENABLED, and a server-only OPENAI_API_KEY are configured.',
      };
    }
    return {
      mode: 'openai',
      permitted: true,
      production,
      founderPilot,
      generationReady: true,
      missing: [],
      blockers: [],
      reason: 'Model-generated application files recorded from the authorized OpenAI adapter.',
    };
  }

  if ((env.ARCHITECT_APPS_FIXTURE === 'true' || env.ARCHITECT_APPS_STORE === 'memory') && flagsReady && !production) {
    return {
      mode: 'fixture',
      permitted: true,
      production,
      founderPilot,
      generationReady: true,
      missing: [],
      blockers: [],
      reason: 'Deterministic fixture application — labelled development evidence, not a live model generation.',
    };
  }

  return {
    mode: 'disabled',
    permitted: true,
    production,
    founderPilot,
    generationReady: false,
    missing,
    blockers: production
      ? [
          'Founder-production app generation stays off until ARCHITECT_APPS_FOUNDER_PILOT, ARCHITECT_APPS_AI_ENABLED, and a server-only OPENAI_API_KEY are configured.',
        ]
      : [],
    reason: production
      ? 'Founder-production app generation stays off until ARCHITECT_APPS_FOUNDER_PILOT, ARCHITECT_APPS_AI_ENABLED, and a server-only OPENAI_API_KEY are configured. Ordinary accounts stay unavailable until their own supported release.'
      : 'App generation stays disabled until ARCHITECT_APPS_ENABLED and either a labelled fixture, a mocked provider, or authorized OpenAI is configured. A funded OpenAI account does not supply a sandbox or hosted publishing.',
  };
}

export function appsGenerationAdmission(
  founder: boolean,
  env: Env = process.env,
): {
  enabled: boolean;
  mode: Exclude<AppsGenerationPolicyMode, 'refused'> | 'disabled';
  reason: string;
  class: AppFailureClass | 'openai' | 'mock' | 'fixture' | 'unavailable';
} {
  const policy = appsGenerationPolicy(env);
  if (policy.mode === 'refused')
    return { enabled: false, mode: 'disabled', reason: policy.reason, class: 'permission' };
  if (policy.mode === 'openai' && !founder)
    return {
      enabled: false,
      mode: 'disabled',
      reason: 'Model-backed application generation is a founder pilot and is not enabled for this account.',
      class: 'permission',
    };
  if (policy.mode === 'disabled' || !policy.generationReady)
    return { enabled: false, mode: 'disabled', reason: policy.reason, class: 'unavailable' };
  if (policy.mode === 'openai') return { enabled: true, mode: 'openai', reason: policy.reason, class: 'openai' };
  if (policy.mode === 'mock') return { enabled: true, mode: 'mock', reason: policy.reason, class: 'mock' };
  return { enabled: true, mode: 'fixture', reason: policy.reason, class: 'fixture' };
}

export function classifyAppRequestFailure(error: unknown): { class: AppFailureClass; message: string } {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
  const reportedClass =
    typeof error === 'object' && error && 'failureClass' in error
      ? String((error as { failureClass?: string }).failureClass)
      : '';
  const message =
    error instanceof Error
      ? error.message
      : 'Application request could not be completed.';
  if (APP_FAILURE_CLASSES.includes(reportedClass as AppFailureClass))
    return { class: reportedClass as AppFailureClass, message };
  if (
    status === 403 ||
    /founder pilot|not enabled for this account|permission|not authorized|ordinary accounts stay unavailable/i.test(
      message,
    )
  )
    return { class: 'permission', message };
  if (/typecheck|bundle|compile|isolated build|sealed toolchain|last working application/i.test(message))
    return { class: 'compile', message };
  if (
    /worker|queued|lease|docker daemon|commissioned|isolation was unavailable|non-Vercel host|Paid generation is unavailable|heartbeat|image-digest/i.test(
      message,
    )
  )
    return { class: 'worker', message };
  if (
    /acceptance run|reserved budget|reserved allowance|token acceptance ceiling|approved override|cannot be cancelled to zero|bound to gpt-6-astra/i.test(
      message,
    )
  )
    return { class: 'model', message };
  if (
    status === 503 ||
    /model|openai|provider adapter|generation is unavailable|generation stays disabled|Model connection unavailable/i.test(
      message,
    )
  )
    return { class: 'model', message };
  return { class: 'model', message };
}

export function describeAppFailure(error: unknown) {
  const classified = classifyAppRequestFailure(error);
  if (classified.class === 'permission') return `Not enabled: ${classified.message}`;
  if (classified.class === 'compile') return `Compile failed: ${classified.message}`;
  if (classified.class === 'worker') return `Worker unavailable: ${classified.message}`;
  return `Model request failed: ${classified.message}`;
}
