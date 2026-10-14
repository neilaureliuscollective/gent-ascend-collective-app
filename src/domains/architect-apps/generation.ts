import { IntelligenceError } from '@/domains/intelligence/service';
import { isGeneratedAppPath, isSealedAppPath } from './catalog';
import { labeledAppSource } from './hash';
import { appsAiMockReady, appsAiReady } from './readiness';
import { appProposalSchema, type AppFile, type AppProposal } from './schema';
import {
  trackerPriorityCollections,
  trackerPriorityOperations,
  trackerProposal,
} from './tracker-fixture';
import { applyFileOperations, overlaySealedFiles } from './tree';

export type AppGenerationMode = 'disabled' | 'fixture' | 'mock' | 'openai';

export function appProposalMode(env: NodeJS.ProcessEnv = process.env): AppGenerationMode {
  if (appsAiMockReady(env)) return 'mock';
  if (appsAiReady(env)) return 'openai';
  if (env.ARCHITECT_APPS_FIXTURE === 'true' || env.ARCHITECT_APPS_STORE === 'memory') return 'fixture';
  return 'disabled';
}

export function appProviderStatus(env: NodeJS.ProcessEnv = process.env) {
  const mode = appProposalMode(env);
  if (mode === 'disabled')
    return {
      enabled: false as const,
      mode,
      reason:
        'App generation stays disabled until ARCHITECT_APPS_ENABLED and either a labelled fixture, a mocked provider, or authorized non-production OpenAI is configured. A funded OpenAI account does not supply a sandbox or hosted publishing.',
    };
  if (mode === 'fixture')
    return {
      enabled: true as const,
      mode,
      reason: labeledAppSource('fixture'),
    };
  if (mode === 'mock')
    return {
      enabled: true as const,
      mode,
      reason: labeledAppSource('mock'),
    };
  return { enabled: true as const, mode, reason: labeledAppSource('openai') };
}

export type AppGenerationTransport = (input: {
  instruction: string;
  kind: 'create' | 'revise';
  files: AppFile[];
}) => Promise<unknown>;

function assertGeneratedOnly(proposal: AppProposal) {
  for (const file of proposal.files) {
    if (!isGeneratedAppPath(file.path) || isSealedAppPath(file.path))
      throw new IntelligenceError('Generated applications may only return files under src/.', 409);
  }
  return proposal;
}

export function mockedTrackerProposal(kind: 'create' | 'revise', base: AppFile[] = []): AppProposal {
  if (kind === 'revise') {
    const operations = trackerPriorityOperations(overlaySealedFiles(base.length ? base : trackerProposal().files));
    const applied = applyFileOperations(overlaySealedFiles(base.length ? base : trackerProposal().files), operations);
    return appProposalSchema.parse({
      summary: 'Add optional item priority with additive host collection schema and priority filtering.',
      files: applied.files.filter((file) => isGeneratedAppPath(file.path)),
      operations,
      collections: trackerPriorityCollections(),
      behaviors: trackerProposal().behaviors,
      notes: labeledAppSource(appProposalMode() === 'mock' ? 'mock' : 'fixture'),
    });
  }
  return assertGeneratedOnly(appProposalSchema.parse(trackerProposal()));
}

export async function generateAppProposal(
  input: {
    instruction: string;
    kind: 'create' | 'revise';
    demo: 'tracker' | 'none';
    baseFiles: AppFile[];
    brief?: string;
    direction?: string;
  },
  transport?: AppGenerationTransport,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ proposal: AppProposal; mode: Exclude<AppGenerationMode, 'disabled'> }> {
  const mode = appProposalMode(env);
  if (mode === 'disabled')
    throw new IntelligenceError(appProviderStatus(env).reason ?? 'App generation is unavailable.', 503);
  if (input.demo !== 'tracker')
    throw new IntelligenceError('This phase supports the labelled project-tracker profile only.', 400);
  if (mode === 'openai' && transport) {
    const raw = await transport({
      instruction: input.instruction,
      kind: input.kind,
      files: input.baseFiles,
    });
    return { proposal: assertGeneratedOnly(appProposalSchema.parse(raw)), mode };
  }
  if (mode === 'openai' && !transport)
    throw new IntelligenceError(
      'OpenAI app generation is authorized but no injected transport was supplied. Paid calls stay off unless a founder-authorized adapter is configured.',
      503,
    );
  return { proposal: mockedTrackerProposal(input.kind, input.baseFiles), mode };
}

export function appGenerationProvenance(mode: Exclude<AppGenerationMode, 'disabled'> | 'unknown') {
  return {
    mode,
    notes: labeledAppSource(mode),
  };
}
