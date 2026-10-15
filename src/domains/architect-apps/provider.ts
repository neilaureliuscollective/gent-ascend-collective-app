import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { IntelligenceError } from '@/domains/intelligence/service';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { sharedCharacter } from '@/domains/intelligence/prompt';
import { isGeneratedAppPath } from './catalog';
import {
  APP_DATA_BRIDGE_CONTRACT,
  buildAppGenerationContext,
  type AppGenerationContext,
} from './context';
import { labeledAppSource } from './hash';
import { notesProposal, notesTagCollections, notesTagOperations } from './notes-fixture';
import { appsAiMockReady, appsAiReady } from './readiness';
import { appProposalSchema, type AppFile, type AppProposal } from './schema';
import { applyFileOperations, overlaySealedFiles } from './tree';
import type { AppGenerationTransport } from './generation';

export function mockedSupportedAppProposal(
  input: {
    kind: 'create' | 'revise';
    files: Array<{ path: string; content: string; hash?: string }>;
    collections?: AppGenerationContext['collections'];
  },
): AppProposal {
  const files: AppFile[] = input.files.map((file) => ({ path: file.path, content: file.content }));
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
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY) throw new IntelligenceError('Model connection unavailable.', 503);
  const context = buildAppGenerationContext(input);
  const openai = createOpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
  });
  const result = await generateText({
    model: openai.responses(config.AURELIUS_AI_MODEL),
    instructions: `You are Aethelios in Architect Apps. ${sharedCharacter}
Return only a validated React/TypeScript/Vite application under src/. You cannot install packages, edit sealed toolchain files, invent servers, authentication, payments or publishing. Preserve unchanged files. Update and delete operations must bind the exact base hashes supplied in context.files. Additive collection schema only. Persist only through the host bridge ${APP_DATA_BRIDGE_CONTRACT.schema}. Follow context.bridge.replay for operation identity. Use only approved direction colors, typography, layout and assets; context.direction.unsupported is out of scope. Paths and character counts are not a revision base.`,
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
    maxOutputTokens: 4000,
    maxRetries: 0,
    timeout: { totalMs: 30000 },
    abortSignal: signal,
    providerOptions: { openai: { store: false } },
  });
  return result.output;
}

export function defaultAppGenerationTransport(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
): AppGenerationTransport | undefined {
  if (appsAiMockReady(env)) return async (input) => mockedSupportedAppProposal(input);
  if (appsAiReady(env)) return (input) => openaiAppTransport(input, signal);
  return undefined;
}
