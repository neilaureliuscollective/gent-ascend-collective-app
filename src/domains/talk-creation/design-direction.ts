import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  designBoardContentSchema,
  selectedDirection,
  type DesignBoardContent,
} from './design-board';

/**
 * LOCAL TEST ADAPTER.
 * Architect owns the published design-direction contract and receiver.
 * #129 has not published that commit. Talk produces this v1-shaped payload
 * for review and isolated transfer tests only. Do not treat a local receipt
 * as an Architect import.
 */
export const designDirectionContract = 'talk-design-direction/v1';
export const designDirectionAdapter = 'local-test' as const;

export const designDirectionManifestSchema = z
  .object({
    schema: z.literal(designDirectionContract),
    adapter: z.literal(designDirectionAdapter),
    source: z
      .object({
        conversationId: z.uuid(),
        boardId: z.uuid(),
        version: z.number().int().positive(),
        directionId: z.string().trim().min(1).max(32),
      })
      .strict(),
    tokens: z.object({
      colors: z.array(
        z.object({
          role: z.string(),
          name: z.string(),
          hex: z.string(),
        }),
      ),
      typography: z.object({
        display: z.string(),
        body: z.string(),
        scale: z.string(),
      }),
      spacing: z.string(),
      shape: z.string(),
      material: z.string(),
    }),
    demo: z.object({
      kind: z.literal('hero-product'),
      headline: z.string(),
      supporting: z.string(),
      cta: z.string(),
      productLabel: z.string(),
    }),
    copy: z.object({
      headline: z.string(),
      subhead: z.string(),
      proof: z.string(),
      disclaimer: z.string(),
    }),
    assets: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['placeholder', 'referenced']),
        provenance: z.string(),
        referenced: z.boolean(),
      }),
    ),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type DesignDirectionManifest = z.infer<typeof designDirectionManifestSchema>;

export function produceDesignDirection(input: {
  conversationId: string;
  boardId: string;
  version: number;
  board: DesignBoardContent;
}): DesignDirectionManifest {
  const board = designBoardContentSchema.parse(input.board);
  const direction = selectedDirection(board);
  const unsigned = {
    schema: designDirectionContract as typeof designDirectionContract,
    adapter: designDirectionAdapter,
    source: {
      conversationId: input.conversationId,
      boardId: input.boardId,
      version: input.version,
      directionId: direction.id,
    },
    tokens: direction.tokens,
    demo: {
      kind: direction.demo.kind,
      headline: direction.demo.headline,
      supporting: direction.demo.supporting,
      cta: direction.demo.cta,
      productLabel: direction.demo.productLabel,
    },
    copy: direction.copy,
    assets: direction.assets,
  };
  const digest = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
  return designDirectionManifestSchema.parse({
    ...unsigned,
    digest,
  });
}

export function designDirectionDigest(value: Omit<DesignDirectionManifest, 'digest'>) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export type LocalDesignTransfer = {
  adapter: typeof designDirectionAdapter;
  imported: boolean;
  projectId: string | null;
  digest: string;
  requestId: string;
  connectedReceiver: false;
  reason: string;
};

const localReason =
  'Architect has not published the design-direction receiver. This is a local test adapter receipt, not an Architect import.';

export function transferDesignDirectionLocal(
  store: Map<string, LocalDesignTransfer>,
  requestId: string,
  manifest: DesignDirectionManifest,
): LocalDesignTransfer {
  const parsed = designDirectionManifestSchema.parse(manifest);
  const existing = store.get(requestId);
  if (existing) {
    if (existing.digest !== parsed.digest)
      throw new Error('Transfer request reused with different content');
    return existing;
  }
  const receipt: LocalDesignTransfer = {
    adapter: designDirectionAdapter,
    imported: false,
    projectId: null,
    digest: parsed.digest,
    requestId,
    connectedReceiver: false,
    reason: localReason,
  };
  store.set(requestId, receipt);
  return receipt;
}
