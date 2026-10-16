import { appsGenerationAdmission } from './generation-policy';
import { classifyPaidGenerationReadiness, type AppsPaidRuntimeEvidence } from './pilot';
import { appsReady } from './readiness';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;
export type AppActivation = {
  ready: boolean;
  checks: { name: string; ready: boolean; detail: string }[];
  note: string;
};

/** Read-only diagnostics. Never grants execution or substitutes for admission at request time. */
export function appActivationStatus(input: {
  founder: boolean;
  runtime: AppsPaidRuntimeEvidence;
  executionPolicy: boolean;
  env?: Env;
}): AppActivation {
  const env = input.env ?? process.env;
  const provider = appsGenerationAdmission(input.founder, env);
  const worker = classifyPaidGenerationReadiness(input.runtime, env);
  const checks = [
    {
      name: 'Application workspace',
      ready: appsReady(env),
      detail: 'Application creation must be activated separately from saved plans.',
    },
    {
      name: 'Founder access',
      ready: input.founder,
      detail: 'The signed-in project owner needs founder-pilot access.',
    },
    {
      name: 'Model generation',
      ready: provider.enabled && provider.mode === 'openai',
      detail: 'The real model adapter needs separately authorized generation configuration.',
    },
    {
      name: 'Database execution policy',
      ready: input.executionPolicy,
      detail:
        'The database execution gate must be explicitly commissioned; web settings alone cannot authorize a build.',
    },
    {
      name: 'Isolated build worker',
      ready: worker.ok,
      detail:
        'A recent isolated worker receipt must match this app and cover schema, queue and compiled artifacts.',
    },
    {
      name: 'Private preview',
      ready:
        (env.ARCHITECT_APPS_PREVIEW_SECRET?.trim().length ?? 0) >= 16 &&
        env.ARCHITECT_APPS_PREVIEW_CLUSTER === 'true',
      detail: 'Private previews require shared preview sessions and matching server configuration.',
    },
  ];
  return {
    ready: checks.every((check) => check.ready),
    checks,
    note: 'This check does not start a build or call a model. GitHub is optional for standalone applications. Readiness is checked again when you request generation.',
  };
}
