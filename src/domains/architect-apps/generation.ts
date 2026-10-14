import { IntelligenceError } from '@/domains/intelligence/service';
import { isGeneratedAppPath, isSealedAppPath } from './catalog';
import {
  buildAppGenerationContext,
  validateProposalAgainstContext,
  type AppGenerationContext,
  type AppGenerationDirection,
} from './context';
import { labeledAppSource } from './hash';
import { appsAiMockReady, appsAiReady } from './readiness';
import { appProposalSchema, type AppCollection, type AppFile, type AppProposal } from './schema';
import {
  trackerPriorityCollections,
  trackerPriorityOperations,
  trackerProposal,
} from './tracker-fixture';
import { applyFileOperations, overlaySealedFiles } from './tree';

export type AppGenerationMode = 'disabled' | 'fixture' | 'mock' | 'openai';

export function appProposalMode(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): AppGenerationMode {
  if (appsAiMockReady(env)) return 'mock';
  if (appsAiReady(env)) return 'openai';
  if (env.ARCHITECT_APPS_FIXTURE === 'true' || env.ARCHITECT_APPS_STORE === 'memory') return 'fixture';
  return 'disabled';
}

export function appProviderStatus(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
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

export type AppGenerationTransport = (input: AppGenerationContext) => Promise<unknown>;

export function assertGeneratedOnly(proposal: AppProposal) {
  for (const file of proposal.files) {
    if (!isGeneratedAppPath(file.path) || isSealedAppPath(file.path))
      throw new IntelligenceError('Generated applications may only return files under src/.', 409);
  }
  if (proposal.operations) {
    for (const operation of proposal.operations) {
      if (!isGeneratedAppPath(operation.path) || isSealedAppPath(operation.path))
        throw new IntelligenceError('Generated applications may only change files under src/.', 409);
    }
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
      notes: labeledAppSource('fixture'),
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
    collections?: AppCollection[];
    brief?: string;
    direction?: AppGenerationDirection;
  },
  transport?: AppGenerationTransport,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<{ proposal: AppProposal; mode: Exclude<AppGenerationMode, 'disabled'>; context: AppGenerationContext }> {
  const mode = appProposalMode(env);
  const context = buildAppGenerationContext({
    instruction: input.instruction,
    kind: input.kind,
    files: input.baseFiles,
    collections: input.collections,
    brief: input.brief,
    direction: input.direction,
  });
  if (mode === 'disabled')
    throw new IntelligenceError(appProviderStatus(env).reason ?? 'App generation is unavailable.', 503);
  if (input.demo === 'tracker') {
    return { proposal: mockedTrackerProposal(input.kind, input.baseFiles), mode: 'fixture', context };
  }
  if (!transport)
    throw new IntelligenceError(
      mode === 'openai'
        ? 'OpenAI app generation is authorized but the provider adapter was not wired. Paid calls stay off unless a founder-authorized adapter runs.'
        : 'App generation requires the mocked or OpenAI adapter. The labelled tracker fixture is available only when demo=tracker.',
      503,
    );
  const raw = await transport(context);
  const proposal = validateProposalAgainstContext(assertGeneratedOnly(appProposalSchema.parse(raw)), context);
  return { proposal, mode, context };
}

export function appGenerationProvenance(mode: Exclude<AppGenerationMode, 'disabled'> | 'unknown') {
  return {
    mode,
    notes: labeledAppSource(mode),
  };
}
