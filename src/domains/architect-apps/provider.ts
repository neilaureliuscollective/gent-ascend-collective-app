import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { IntelligenceError } from '@/domains/intelligence/service';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { sharedCharacter } from '@/domains/intelligence/prompt';
import { isGeneratedAppPath, isSealedAppPath } from './catalog';
import { labeledAppSource } from './hash';
import { notesProposal, notesTagCollections, notesTagOperations } from './notes-fixture';
import { appsAiMockReady, appsAiReady } from './readiness';
import { appProposalSchema, type AppFile, type AppProposal } from './schema';
import { applyFileOperations, overlaySealedFiles } from './tree';
import type { AppGenerationTransport } from './generation';

export function mockedSupportedAppProposal(input: { kind: 'create' | 'revise'; files: AppFile[] }): AppProposal {
  if (input.kind === 'revise') {
    const base = overlaySealedFiles(input.files.length ? input.files : notesProposal().files);
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

export async function openaiAppTransport(
  input: { instruction: string; kind: 'create' | 'revise'; files: AppFile[] },
  signal?: AbortSignal,
): Promise<unknown> {
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY) throw new IntelligenceError('Model connection unavailable.', 503);
  const openai = createOpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
  });
  const result = await generateText({
    model: openai.responses(config.AURELIUS_AI_MODEL),
    instructions: `You are Aethelios in Architect Apps. ${sharedCharacter}
Return only a validated React/TypeScript/Vite application under src/. You cannot install packages, edit sealed toolchain files, invent servers, authentication, payments or publishing. Preserve unchanged files. Update and delete operations must bind exact base hashes. Additive collection schema only.`,
    prompt: JSON.stringify({
      instruction: input.instruction.slice(0, 2000),
      kind: input.kind,
      base_files: input.files
        .filter((file) => isGeneratedAppPath(file.path) && !isSealedAppPath(file.path))
        .map((file) => ({ path: file.path, bytes: file.content.length })),
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
