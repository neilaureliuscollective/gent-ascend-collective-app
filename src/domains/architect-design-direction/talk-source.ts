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
 * Narrow Talk workstream boundary. Architect does not invent a Talk board store.
 * A separate Talk branch must resolve conversation, board, version, direction and
 * assets from authorized immutable server records and return those records here.
 */
export type TalkSourceAdapter = {
  resolve(input: {
    personId: string;
    receipt: DesignDirectionReceipt;
  }): Promise<AuthorizedTalkSource | null>;
};

let adapter: TalkSourceAdapter | null = null;

export function registerTalkSourceAdapter(next: TalkSourceAdapter | null) {
  adapter = next;
}

export function talkSourceAdapterStatus() {
  if (adapter)
    return {
      ready: true as const,
      schema: DESIGN_DIRECTION_SCHEMA,
      reason: 'Talk authorized source adapter is registered. Client-supplied hashes are not authority.',
    };
  return {
    ready: false as const,
    schema: DESIGN_DIRECTION_SCHEMA,
    reason:
      'Talk authorized source adapter is pending on its separate workstream. Architect will not invent a Talk store or treat client-supplied content/sourceRecords as verification of referenced Talk work. Compatible talk-architect-handoff/v1 text import remains available.',
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
  if (resolved.digest !== input.receipt.digest && resolved.kind === 'talk-authorized') {
    throw new IntelligenceError(
      'Design-direction digest does not match authorized Talk server records. A client-supplied hash is not authority.',
      409,
    );
  }
  return resolved;
}
