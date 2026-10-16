import 'server-only';
import { IntelligenceError } from '@/domains/intelligence/service';
import {
  canonicalDesignJson,
  designDirectionDigest,
  designDirectionReceiptSchema,
  type DesignDirectionReceipt,
} from '@/domains/architect-design-direction/contract';

export const PREMIUM_RECEIPT_AUTHORITY = 'talk-premium-receipt/v1';
export const PREMIUM_RECEIPT_UNAVAILABLE =
  'Premium design transfer is not available on this database yet. Your saved direction stays in Talk; nothing has started in Architect.';

type ReceiptClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
};

/** A fresh owner-session DB derivation is required, never a client capability flag.
 * Review/receive/read all fail closed before project binding or generation.
 */
export async function requirePremiumReceiptAuthority(
  client: ReceiptClient,
  expected: DesignDirectionReceipt,
) {
  if (!expected.content.designSnapshot) return;
  const { data, error } = await client.rpc('ai_talk_review_premium_direction', {
    p_conversation: expected.identity.conversationId,
    p_board: expected.identity.boardId,
    p_version: expected.identity.boardVersion,
  });
  if (error) {
    if (['42883', 'PGRST202', 'PGRST204'].includes(error.code ?? ''))
      throw new IntelligenceError(PREMIUM_RECEIPT_UNAVAILABLE, 409);
    throw new IntelligenceError(
      'The exact owned premium design could not be verified. Retry before continuing.',
      error.code === '42501' ? 409 : 503,
    );
  }
  const response = data as { capability?: string; receipt?: unknown } | null;
  const derived = designDirectionReceiptSchema.safeParse(response?.receipt);
  if (
    response?.capability !== PREMIUM_RECEIPT_AUTHORITY ||
    !derived.success ||
    !derived.data.content.designSnapshot
  )
    throw new IntelligenceError(PREMIUM_RECEIPT_UNAVAILABLE, 409);
  if (
    derived.data.digest !== expected.digest ||
    designDirectionDigest(derived.data.content, derived.data.sourceRecords) !== expected.digest ||
    canonicalDesignJson(derived.data) !== canonicalDesignJson(expected)
  )
    throw new IntelligenceError(
      'This premium source or receipt changed. Review its exact saved version again.',
      409,
    );
}
