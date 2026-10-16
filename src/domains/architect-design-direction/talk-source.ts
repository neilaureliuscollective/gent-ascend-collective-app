import { IntelligenceError } from '@/domains/intelligence/service';
import {
  DESIGN_DIRECTION_SCHEMA,
  TEXT_HANDOFF_SCHEMA,
  designDirectionDigest,
  type DesignDirectionReceipt,
} from './contract';

export type TalkSourceKind = 'text-import' | 'talk-authorized' | 'pending';

export type AuthorizedTalkSource = {
  kind: Exclude<TalkSourceKind, 'pending'>;
  digest: string;
  receipt: DesignDirectionReceipt;
  note: string;
};

/**
 * Published shared contract with the Talk workstream.
 * Architect receives. Talk produces and authorizes conversation/board/version/direction.
 * A client-computed content digest is never source authorization.
 */
export const TALK_SOURCE_SHARED_CONTRACT = {
  id: 'talk.architect.source.resolve',
  version: '2026-10-14.1',
  schema: DESIGN_DIRECTION_SCHEMA,
  compatibleTextImport: TEXT_HANDOFF_SCHEMA,
  authority:
    'Immutable Talk server records for conversation, board, version, direction and assets. A client-computed content digest is not source authorization.',
  architectModule: 'src/domains/architect-design-direction/talk-source.ts',
  talkProducer: 'Talk workstream talk-architect-handoff/v1, received as talk-architect-direction/v1',
  pending:
    'Talk has not registered an authorized source adapter on this Architect checkout. Durable receipts remain. Architect will not invent a Talk board store.',
} as const;

/**
 * Narrow Talk workstream boundary. Architect does not invent a Talk board store.
 * Talk registers an adapter that resolves conversation, board, version, direction and
 * assets from authorized immutable server records.
 */
export type TalkSourceAdapter = {
  contract: typeof TALK_SOURCE_SHARED_CONTRACT;
  resolve(input: {
    personId: string;
    receipt: DesignDirectionReceipt;
  }): Promise<AuthorizedTalkSource | null>;
};

let adapter: TalkSourceAdapter | null = null;

export function registerTalkSourceAdapter(next: TalkSourceAdapter | null) {
  if (next && next.contract.schema !== DESIGN_DIRECTION_SCHEMA)
    throw new IntelligenceError('Talk source adapter must use the published talk-architect-direction/v1 contract.', 409);
  adapter = next;
}

export function talkSourceAdapterStatus() {
  if (adapter)
    return {
      ready: true as const,
      schema: DESIGN_DIRECTION_SCHEMA,
      contract: TALK_SOURCE_SHARED_CONTRACT,
      reason: 'Talk authorized source adapter is registered. Client-supplied hashes are not authority.',
    };
  return {
    ready: false as const,
    schema: DESIGN_DIRECTION_SCHEMA,
    contract: TALK_SOURCE_SHARED_CONTRACT,
    reason: TALK_SOURCE_SHARED_CONTRACT.pending,
  };
}

export function isCompatibleTextImport(receipt: DesignDirectionReceipt) {
  return (
    receipt.content.schema === DESIGN_DIRECTION_SCHEMA &&
    receipt.content.compatibleTextImport === TEXT_HANDOFF_SCHEMA
  );
}

export async function resolveAuthorizedTalkSource(input: {
  personId: string;
  receipt: DesignDirectionReceipt;
}): Promise<AuthorizedTalkSource> {
  if (input.receipt.content.designSnapshot && isCompatibleTextImport(input.receipt))
    throw new IntelligenceError('Compatible text imports cannot carry a premium design snapshot.', 409);
  if (isCompatibleTextImport(input.receipt)) {
    const digest = designDirectionDigest(input.receipt.content, input.receipt.sourceRecords);
    if (digest !== input.receipt.digest)
      throw new IntelligenceError(
        'Design-direction digest does not match the submitted text-import payload. A client-supplied hash is not authority.',
        409,
      );
    if (
      input.receipt.identity.conversationId !== input.receipt.content.identity.conversationId ||
      input.receipt.identity.boardId !== input.receipt.content.identity.boardId ||
      input.receipt.identity.directionId !== input.receipt.content.identity.directionId ||
      input.receipt.identity.boardVersion !== input.receipt.content.identity.boardVersion
    )
      throw new IntelligenceError('Foreign conversation or board identity.', 409);
    return {
      kind: 'text-import',
      digest,
      receipt: input.receipt,
      note: 'Compatible talk-architect-handoff/v1 text import. This is not verification of a Talk design board.',
    };
  }
  if (!adapter) {
    throw new IntelligenceError(talkSourceAdapterStatus().reason, 503);
  }
  const resolved = await adapter.resolve(input);
  if (!resolved)
    throw new IntelligenceError(
      'Referenced Talk conversation, board, version or direction is unavailable to this owner.',
      404,
    );
  if (resolved.receipt.content.designSnapshot && (resolved.kind !== 'talk-authorized' || isCompatibleTextImport(resolved.receipt)))
    throw new IntelligenceError('Premium snapshots require an authorized Talk source.', 409);
  const authorizedDigest = designDirectionDigest(resolved.receipt.content, resolved.receipt.sourceRecords);
  if (resolved.kind === 'talk-authorized' && resolved.digest !== authorizedDigest)
    throw new IntelligenceError(
      'Talk source adapter returned a digest that does not match authorized Talk server records. A client-supplied hash is not authority.',
      409,
    );
  if (resolved.kind === 'talk-authorized' && resolved.digest !== input.receipt.digest) {
    throw new IntelligenceError(
      'Design-direction digest does not match authorized Talk server records. A client-computed content digest is not source authorization.',
      409,
    );
  }
  return resolved;
}

export function createTalkAuthorizedSourceAdapter(
  resolve: TalkSourceAdapter['resolve'],
): TalkSourceAdapter {
  return {
    contract: TALK_SOURCE_SHARED_CONTRACT,
    resolve,
  };
}
