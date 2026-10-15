import {
  DESIGN_DIRECTION_SCHEMA,
  designDirectionDigest,
  designDirectionReceiptSchema,
  designDirectionContentSchema,
  type DesignDirectionContent,
  type DesignDirectionReceipt,
} from '@/domains/architect-design-direction/contract';
import { scopedTalkIdentity } from './persist';
import {
  selectedDirection,
  type DesignBoardContent,
  type DesignDirection,
} from './design-board';

/**
 * Talk producer mapping onto Architect-owned talk-architect-direction/v1.
 * Architect owns the schema. Talk does not invent a competing contract.
 *
 * Compatible mapping:
 * - direction slug → deterministic UUID talk-direction:{boardId}:{slug}
 * - background→canvas, text→ink, muted→muted, accent→accent, highlight→reserve
 * - #0B3B32 or Imperial/Mineral Green → emerald
 * - typography families stay in Talk; Architect receives display/body tokens
 * - spacing compact→stack, balanced→split, generous→gallery; board is always included
 *
 * Unsupported in Architect v1 (remain on the Talk board):
 * - hero-product demonstration (Architect demo is tracker|none)
 * - surface/border color roles, font names, shape, material, proposed disclaimer
 * - placeholder packaging pixels
 */
export const talkColorRoleMap = {
  background: 'canvas',
  text: 'ink',
  muted: 'muted',
  accent: 'accent',
  highlight: 'reserve',
} as const;

export const unsupportedTalkFields = [
  'hero-product demonstration',
  'surface and border color roles',
  'typeface names and scale',
  'shape and material tokens',
  'copy.disclaimer',
  'placeholder packaging pixels',
] as const;

export function directionIdentity(boardId: string, directionId: string) {
  return scopedTalkIdentity(`talk-direction:${boardId}:${directionId}`);
}

export function assetIdentity(boardId: string, assetId: string) {
  return scopedTalkIdentity(`talk-asset:${boardId}:${assetId}`);
}

export function directionProjectIdentity(
  personId: string,
  boardId: string,
  version: number,
  directionId: string,
) {
  return scopedTalkIdentity(`talk-direction-project:${personId}:${boardId}:${version}:${directionId}`);
}

function mapColors(direction: DesignDirection) {
  const colors: DesignDirectionContent['colors'] = [];
  const used = new Set<string>();
  for (const color of direction.tokens.colors) {
    const role = talkColorRoleMap[color.role as keyof typeof talkColorRoleMap];
    if (!role || used.has(role)) continue;
    used.add(role);
    colors.push({ role, value: color.hex.toUpperCase() });
  }
  const emerald = direction.tokens.colors.find(
    (color) =>
      color.hex.toUpperCase() === '#0B3B32' || /green/i.test(color.name),
  );
  if (emerald && !used.has('emerald'))
    colors.push({ role: 'emerald', value: emerald.hex.toUpperCase() });
  return colors;
}

function mapLayout(direction: DesignDirection): DesignDirectionContent['layout'] {
  const spacing =
    direction.tokens.spacing === 'compact'
      ? 'stack'
      : direction.tokens.spacing === 'generous'
        ? 'gallery'
        : 'split';
  return [spacing, 'board'];
}

export function produceArchitectDirection(input: {
  conversationId: string;
  boardId: string;
  version: number;
  board: DesignBoardContent;
}): DesignDirectionReceipt {
  const direction = selectedDirection(input.board);
  const identity = {
    conversationId: input.conversationId,
    boardId: input.boardId,
    boardVersion: input.version,
    directionId: directionIdentity(input.boardId, direction.id),
  };
  const content: DesignDirectionContent = {
    schema: DESIGN_DIRECTION_SCHEMA,
    identity,
    name: direction.name.slice(0, 100),
    summary: `${input.board.product}: ${direction.demo.headline}`.slice(0, 2000),
    colors: mapColors(direction),
    typography: ['display', 'body'],
    layout: mapLayout(direction),
    demo: {
      kind: 'none',
      labelled: true,
      note: input.board.rendererVersion === 'premium/v2' ? 'Exact creative retained in designSnapshot. This receipt does not commission a build.' : 'Talk hero-product demonstration stays in Talk. Architect v1 accepts tracker or none only.',
    },
    copy: {
      title: direction.copy.headline.slice(0, 120),
      approved: [direction.copy.subhead, direction.copy.proof]
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 16),
    },
    ...(input.board.rendererVersion === 'premium/v2' ? { designSnapshot: {
      rendererVersion: input.board.rendererVersion,
      product: input.board.product,
      direction,
    } } : {}),
    assets: direction.assets.map((asset) => ({
      id: assetIdentity(input.boardId, asset.id),
      kind: 'image' as const,
      provenance: 'talk' as const,
      note: `${asset.label} · ${asset.kind} · ${asset.provenance}`.slice(0, 400),
    })),
  };
  const canonicalContent = designDirectionContentSchema.parse(content);
  const sourceRecords = [
    { kind: 'conversation' as const, id: input.conversationId },
    { kind: 'board' as const, id: input.boardId, revision: input.version },
    { kind: 'direction' as const, id: identity.directionId, revision: input.version },
  ];
  return designDirectionReceiptSchema.parse({
    schema: DESIGN_DIRECTION_SCHEMA,
    identity,
    content: canonicalContent,
    digest: designDirectionDigest(canonicalContent, sourceRecords),
    sourceRecords,
  });
}
