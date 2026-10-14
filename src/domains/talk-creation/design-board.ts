import { z } from 'zod';

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const bounded = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const slug = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,31}$/);

export const designColorRoles = [
  'background',
  'surface',
  'text',
  'accent',
  'highlight',
  'muted',
  'border',
] as const;

export const designBoardColorSchema = z
  .object({
    role: z.enum(designColorRoles),
    name: required(40),
    hex: hexColor,
  })
  .strict();

export const designBoardTokensSchema = z
  .object({
    colors: z.array(designBoardColorSchema).min(4).max(8),
    typography: z
      .object({
        display: required(40),
        body: required(40),
        scale: z.enum(['tight', 'measured', 'open']),
      })
      .strict(),
    spacing: z.enum(['compact', 'balanced', 'generous']),
    shape: z.enum(['sharp', 'soft', 'pill']),
    material: z.enum(['obsidian', 'carbon', 'emerald-glass', 'stone']),
  })
  .strict();

export const designBoardAssetSchema = z
  .object({
    id: slug,
    label: required(80),
    kind: z.enum(['placeholder', 'referenced']),
    provenance: required(80),
    referenced: z.boolean(),
  })
  .strict();

export const designBoardDemoSchema = z
  .object({
    kind: z.literal('hero-product'),
    headline: required(80),
    supporting: bounded(200),
    cta: required(40),
    productLabel: required(80),
    image: designBoardAssetSchema,
  })
  .strict();

export const designBoardCopySchema = z
  .object({
    headline: required(80),
    subhead: bounded(200),
    proof: required(200),
    disclaimer: required(160),
  })
  .strict();

export const designDirectionSchema = z
  .object({
    id: slug,
    name: required(40),
    tokens: designBoardTokensSchema,
    demo: designBoardDemoSchema,
    copy: designBoardCopySchema,
    assets: z.array(designBoardAssetSchema).max(6),
  })
  .strict();

export const designBoardContentSchema = z
  .object({
    schema: z.literal('talk-design-board/v1'),
    title: required(80),
    product: required(80),
    notes: bounded(400),
    selectedDirectionId: slug,
    directions: z.array(designDirectionSchema).min(2).max(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.directions.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Direction ids must be unique.',
        path: ['directions'],
      });
    }
    if (!ids.includes(value.selectedDirectionId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selected direction must exist on this board.',
        path: ['selectedDirectionId'],
      });
    }
  });

export type DesignBoardContent = z.infer<typeof designBoardContentSchema>;
export type DesignDirection = z.infer<typeof designDirectionSchema>;

export function selectedDirection(board: DesignBoardContent) {
  return board.directions.find((item) => item.id === board.selectedDirectionId) ?? board.directions[0]!;
}

export function selectDesignDirection(board: DesignBoardContent, directionId: string): DesignBoardContent {
  const parsed = designBoardContentSchema.parse(board);
  if (!parsed.directions.some((item) => item.id === directionId))
    throw new Error('That direction is not on this board.');
  return { ...parsed, selectedDirectionId: directionId };
}

export function adjustDesignSwatch(
  board: DesignBoardContent,
  input: { directionId: string; role: (typeof designColorRoles)[number]; hex: string },
): DesignBoardContent {
  const parsed = designBoardContentSchema.parse(board);
  return designBoardContentSchema.parse({
    ...parsed,
    selectedDirectionId: input.directionId,
    directions: parsed.directions.map((direction) =>
      direction.id === input.directionId
        ? {
            ...direction,
            tokens: {
              ...direction.tokens,
              colors: direction.tokens.colors.map((color) =>
                color.role === input.role ? { ...color, hex: hexColor.parse(input.hex) } : color,
              ),
            },
          }
        : direction,
    ),
  });
}

export function bindOfferedBoard(
  current: DesignBoardContent,
  offered: DesignBoardContent,
): DesignBoardContent {
  const saved = designBoardContentSchema.parse(current);
  const incoming = designBoardContentSchema.parse(offered);
  const selectedId = saved.selectedDirectionId;
  const next = incoming.directions.find((item) => item.id === selectedId);
  if (!next) throw new Error('Refinement must target the selected direction.');
  return designBoardContentSchema.parse({
    ...saved,
    selectedDirectionId: selectedId,
    directions: saved.directions.map((item) => (item.id === selectedId ? next : item)),
  });
}

export function refineSelectedDirection(
  board: DesignBoardContent,
  input: { warmer?: boolean; role?: (typeof designColorRoles)[number]; hex?: string },
): DesignBoardContent {
  const current = selectedDirection(board);
  if (input.role && input.hex) return adjustDesignSwatch(board, { directionId: current.id, role: input.role, hex: input.hex });
  if (!input.warmer) return selectDesignDirection(board, current.id);
  return designBoardContentSchema.parse({
    ...board,
    directions: board.directions.map((direction) =>
      direction.id === current.id
        ? {
            ...direction,
            tokens: {
              ...direction.tokens,
              colors: direction.tokens.colors.map((color) =>
                color.role === 'highlight' || color.role === 'accent'
                  ? { ...color, hex: warmerHex(color.hex) }
                  : color,
              ),
            },
          }
        : direction,
    ),
  });
}

function warmerHex(hex: string) {
  const value = hex.replace('#', '');
  const r = Math.min(255, parseInt(value.slice(0, 2), 16) + 18);
  const g = Math.min(255, parseInt(value.slice(2, 4), 16) + 8);
  const b = Math.max(0, parseInt(value.slice(4, 6), 16) - 12);
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

export function legacyReserveBoard(): DesignBoardContent {
  return designBoardContentSchema.parse({
    schema: 'talk-design-board/v1',
    title: 'Legacy Reserve directions',
    product: 'Legacy Reserve',
    notes:
      'Confirmed: Legacy Reserve is the separate grooming and commerce brand. Demonstration packaging and proposed copy are labelled. Approved product claims are not invented.',
    selectedDirectionId: 'direction-b',
    directions: [
      direction(
        'direction-a',
        'Graphite Chamber',
        {
          colors: [
            { role: 'background', name: 'Obsidian', hex: '#050706' },
            { role: 'surface', name: 'Carbon', hex: '#121416' },
            { role: 'text', name: 'Ivory', hex: '#F4EFE6' },
            { role: 'accent', name: 'Steel', hex: '#8B9198' },
            { role: 'highlight', name: 'Reserve Gold', hex: '#C4912F' },
            { role: 'muted', name: 'Ash', hex: '#9AA0A6' },
            { role: 'border', name: 'Graphite', hex: '#2A2E32' },
          ],
          typography: { display: 'Sora', body: 'Inter', scale: 'tight' },
          spacing: 'compact',
          shape: 'sharp',
          material: 'carbon',
        },
        'A cooler chamber for the line.',
        'Quiet carbon, exact gold.',
      ),
      direction(
        'direction-b',
        'Warm Reserve',
        {
          colors: [
            { role: 'background', name: 'Depth', hex: '#0D211B' },
            { role: 'surface', name: 'Chamber', hex: '#163028' },
            { role: 'text', name: 'Champagne', hex: '#E4BD70' },
            { role: 'accent', name: 'Imperial Green', hex: '#0B3B32' },
            { role: 'highlight', name: 'Reserve Gold', hex: '#C4912F' },
            { role: 'muted', name: 'Mineral', hex: '#7F8A7A' },
            { role: 'border', name: 'Forest', hex: '#205443' },
          ],
          typography: { display: 'Sora', body: 'Inter', scale: 'measured' },
          spacing: 'balanced',
          shape: 'soft',
          material: 'stone',
        },
        'A warmer reserve for the line.',
        'Stone, champagne and gold.',
      ),
      direction(
        'direction-c',
        'Emerald Glass',
        {
          colors: [
            { role: 'background', name: 'Green-black', hex: '#07140F' },
            { role: 'surface', name: 'Glass', hex: '#0B3B32' },
            { role: 'text', name: 'Ivory', hex: '#F4EFE6' },
            { role: 'accent', name: 'Mineral Green', hex: '#205443' },
            { role: 'highlight', name: 'Champagne', hex: '#E4BD70' },
            { role: 'muted', name: 'Sage', hex: '#8A9A8C' },
            { role: 'border', name: 'Emerald', hex: '#145246' },
          ],
          typography: { display: 'Sora', body: 'Inter', scale: 'open' },
          spacing: 'generous',
          shape: 'pill',
          material: 'emerald-glass',
        },
        'A glass reading of the line.',
        'Restrained emerald, no empty theatre.',
      ),
    ],
  });
}

function direction(
  id: string,
  name: string,
  tokens: DesignDirection['tokens'],
  headline: string,
  supporting: string,
): DesignDirection {
  return {
    id,
    name,
    tokens,
    demo: {
      kind: 'hero-product',
      headline,
      supporting,
      cta: 'Review the line',
      productLabel: 'Demonstration packaging — not a product photograph',
      image: {
        id: `${id}-pack`,
        label: 'Placeholder bottle silhouette',
        kind: 'placeholder',
        provenance: 'talk-demo',
        referenced: false,
      },
    },
    copy: {
      headline,
      subhead: supporting,
      proof: 'Confirmed brand fact: Legacy Reserve is the separate product brand of Gent Ascend Collective.',
      disclaimer: 'Proposed copy. Not an approved claim or live merchandising offer.',
    },
    assets: [
      {
        id: 'crest',
        label: 'Official crest',
        kind: 'referenced',
        provenance: 'brand-identity',
        referenced: true,
      },
    ],
  };
}
