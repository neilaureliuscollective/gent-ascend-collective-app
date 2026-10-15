import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { IntelligenceError } from '@/domains/intelligence/service';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { APP_ACCEPTANCE_MODEL, appGenerationInstructions, assertApprovedAppGenerationModel } from './budget';
import { isGeneratedAppPath } from './catalog';
import { buildAppGenerationContext, type AppGenerationContext } from './context';
import { fileHash, labeledAppSource } from './hash';
import {
  notesBrokenTypecheckOperations,
  notesProposal,
  notesTagCollections,
  notesTagOperations,
} from './notes-fixture';
import { APP_GENERATION_LIMITS } from './generation-policy';
import { appsAiMockReady, appsAiReady } from './readiness';
import { appProposalSchema, type AppFile, type AppProposal } from './schema';
import { applyFileOperations, overlaySealedFiles } from './tree';
import type { AppGenerationTransport } from './generation';

export function isBrokenTypecheckInstruction(instruction?: string) {
  return Boolean(instruction && /break the isolated typecheck/i.test(instruction));
}

export function mockedSupportedAppProposal(
  input: {
    kind: 'create' | 'revise';
    files: Array<{ path: string; content: string; hash?: string }>;
    collections?: AppGenerationContext['collections'];
    instruction?: string;
  },
): AppProposal {
  const files: AppFile[] = input.files.map((file) => ({ path: file.path, content: file.content }));
  if (input.kind === 'revise' && isBrokenTypecheckInstruction(input.instruction)) {
    const base = overlaySealedFiles(files.length ? files : notesProposal().files);
    const operations = notesBrokenTypecheckOperations(base);
    const applied = applyFileOperations(base, operations);
    return appProposalSchema.parse({
      summary: 'Labelled compile-failure revision that keeps the last working application.',
      files: applied.files.filter((file) => isGeneratedAppPath(file.path)),
      operations,
      collections: input.collections?.length ? input.collections : notesProposal().collections,
      behaviors: notesProposal().behaviors,
      notes: 'Labelled mocked compile-failure fixture. This is not a paid OpenAI call.',
    });
  }
  if (input.kind === 'revise' && /warm gold heading/i.test(input.instruction ?? '')) {
    const base = overlaySealedFiles(files);
    const app = base.find((file) => file.path === 'src/App.tsx');
    if (!app || !app.content.includes('<h1 data-architect-target='))
      throw new Error('The labelled visual fixture requires the verified notes heading.');
    const operations = [{
      op: 'update' as const,
      path: app.path,
      baseHash: fileHash(app.content),
      content: app.content.replace('<h1 data-architect-target=', '<h1 style={{ color: "#e8c980", letterSpacing: "0.03em" }} data-architect-target='),
    }];
    return appProposalSchema.parse({
      summary: 'Warm gold heading; keep saved notes, validation and hours calculation unchanged.',
      files: applyFileOperations(base, operations).files.filter((file) => isGeneratedAppPath(file.path)),
      operations,
      collections: input.collections?.length ? input.collections : notesProposal().collections,
      behaviors: notesProposal().behaviors,
      notes: 'Labelled deterministic visual revision, not a paid model call.',
    });
  }
  if (input.kind === 'revise') {
    const base = overlaySealedFiles(files.length ? files : notesProposal().files);
    const operations = notesTagOperations(base);
    const applied = applyFileOperations(base, operations);
    return appProposalSchema.parse({
      summary: 'Add an optional note tag with additive host collection schema.',
      files: applied.files.filter((file) => isGeneratedAppPath(file.path)),
      operations,
      collections: notesTagCollections(),
      behaviors: notesProposal().behaviors,
      notes: labeledAppSource('mock'),
    });
  }
  return appProposalSchema.parse(notesProposal());
}

export async function openaiAppTransport(input: AppGenerationContext, signal?: AbortSignal): Promise<unknown> {
  assertApprovedAppGenerationModel();
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY) throw new IntelligenceError('Model connection unavailable.', 503);
  const context = buildAppGenerationContext(input);
  const openai = createOpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
  });
  const result = await generateText({
    model: openai.responses(APP_ACCEPTANCE_MODEL),
    instructions: appGenerationInstructions(),
    prompt: JSON.stringify({
      instruction: context.instruction,
      kind: context.kind,
      files: context.files,
      collections: context.collections,
      bridge: context.bridge,
      brief: context.brief ?? null,
      direction: context.direction ?? null,
    }),
    output: Output.object({ schema: appProposalSchema }),
    maxOutputTokens: APP_GENERATION_LIMITS.maxOutputTokens,
    maxRetries: APP_GENERATION_LIMITS.maxRetries,
    timeout: { totalMs: APP_GENERATION_LIMITS.timeoutMs },
    abortSignal: signal,
    providerOptions: { openai: { store: false } },
  });
  return result.output;
}

export function defaultAppGenerationTransport(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
): AppGenerationTransport | undefined {
  if (appsAiMockReady(env))
    return async (input) =>
      mockedSupportedAppProposal({
        kind: input.kind,
        files: input.files,
        collections: input.collections,
        instruction: input.instruction,
      });
  if (appsAiReady(env)) return (input) => openaiAppTransport(input, signal);
  return undefined;
}
