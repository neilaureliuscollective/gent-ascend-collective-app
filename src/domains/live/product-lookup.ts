import { z } from 'zod';
import {
  healthConcernAlone,
  loadProductKnowledge,
  productQuestionRelevant,
  type ProductKnowledgeReaders,
  type ProductKnowledgeSnapshot,
} from '@/domains/intelligence/product-knowledge';

export const PRODUCT_LOOKUP_LIMIT = 6;
export const PRODUCT_LOOKUP_TIMEOUT_MS = 8000;
export const PRODUCT_LOOKUP_OUTPUT_CHARS = 8000;

export const productLookupTool = {
  type: 'function',
  name: 'lookup_lifestyle_catalog',
  description:
    'Read-only Lifestyle catalog facts for the current spoken product question. Use when the person asks about products, price, stock, ingredients or variants after this call started. No purchase, cart, Admin or write. A health concern alone is not a catalog request. Results may be stale, empty, failed or ambiguous.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: "The current product question in the person's words.",
      },
    },
    required: ['question'],
    additionalProperties: false,
  },
};

const productLookupInput = z.object({ question: z.string().trim().min(1).max(500) }).strict();

export type ProductLookupGate = {
  sessionActive: () => Promise<boolean>;
  catalog: ProductKnowledgeReaders['catalog'];
  detail?: ProductKnowledgeReaders['detail'];
  now?: Date;
};

export type ProductLookupOutput = {
  status: 'ready' | 'stale' | 'empty' | 'failed' | 'ambiguous' | 'rejected';
  reason?: string;
  freshness?: ProductKnowledgeSnapshot['freshness'];
  unresolved?: boolean;
  clarifyingQuestion?: string | null;
  snapshot?: ProductKnowledgeSnapshot | null;
};

function forbiddenArgument(raw: string) {
  return /https?:\/\/|authorization|bearer\s|api[_-]?key|shopify.*token|person_id|owner_id|credential/i.test(
    raw,
  );
}

function boundOutput(value: ProductLookupOutput): ProductLookupOutput {
  const text = JSON.stringify(value);
  if (text.length <= PRODUCT_LOOKUP_OUTPUT_CHARS) return value;
  return {
    status: value.status,
    reason: 'bounded-output',
    freshness: value.freshness,
    unresolved: value.unresolved,
    clarifyingQuestion: value.clarifyingQuestion,
    snapshot: value.snapshot
      ? { ...value.snapshot, records: value.snapshot.records.slice(0, 2) }
      : null,
  };
}

export function createProductLookupRuntime(gate: ProductLookupGate) {
  const seen = new Set<string>();
  let inFlight = 0;
  let count = 0;

  return {
    seen,
    async run(
      callId: string,
      raw: string,
      recentUserTexts: readonly string[] = [],
    ): Promise<{ emit: boolean; output: ProductLookupOutput | null }> {
      if (!callId || seen.has(callId)) return { emit: false, output: null };
      seen.add(callId);
      if (!(await gate.sessionActive()))
        return { emit: true, output: { status: 'rejected', reason: 'session-ended' } };
      if (count >= PRODUCT_LOOKUP_LIMIT)
        return { emit: true, output: { status: 'rejected', reason: 'lookup-rate-limit' } };
      if (inFlight > 0)
        return { emit: true, output: { status: 'rejected', reason: 'lookup-busy' } };
      if (raw.length > 4096 || forbiddenArgument(raw))
        return { emit: true, output: { status: 'rejected', reason: 'invalid-lookup-argument' } };
      let question: string;
      try {
        question = productLookupInput.parse(JSON.parse(raw)).question;
      } catch {
        return { emit: true, output: { status: 'rejected', reason: 'invalid-lookup-argument' } };
      }
      if (healthConcernAlone(question))
        return { emit: true, output: { status: 'rejected', reason: 'health-not-commerce' } };
      if (!productQuestionRelevant(question))
        return { emit: true, output: { status: 'empty', reason: 'not-a-product-question' } };
      count += 1;
      inFlight += 1;
      try {
        const snapshot = await Promise.race([
          loadProductKnowledge(
            question,
            { catalog: gate.catalog, detail: gate.detail, now: gate.now },
            { recentUserTexts },
          ),
          new Promise<null>((_resolve, reject) => {
            setTimeout(() => reject(new Error('lookup-timeout')), PRODUCT_LOOKUP_TIMEOUT_MS);
          }),
        ]);
        if (!(await gate.sessionActive())) return { emit: false, output: null };
        if (!snapshot)
          return {
            emit: true,
            output: { status: 'empty', reason: 'not-a-product-question' },
          };
        const status: ProductLookupOutput['status'] =
          snapshot.status === 'error'
            ? 'failed'
            : snapshot.status === 'ambiguous'
              ? 'ambiguous'
              : snapshot.status === 'unconfigured' || snapshot.status === 'empty'
                ? 'empty'
                : snapshot.status === 'stale'
                  ? 'stale'
                  : snapshot.records.length
                    ? 'ready'
                    : 'empty';
        return {
          emit: true,
          output: boundOutput({
            status,
            reason: snapshot.connectionRequirement ?? undefined,
            freshness: snapshot.freshness,
            unresolved: snapshot.unresolved,
            clarifyingQuestion: snapshot.clarifyingQuestion,
            snapshot,
          }),
        };
      } catch {
        if (!(await gate.sessionActive())) return { emit: false, output: null };
        return { emit: true, output: { status: 'failed', reason: 'catalog-unavailable' } };
      } finally {
        inFlight -= 1;
      }
    },
  };
}
