import { z } from 'zod';
import {
  DEFAULT_PPI,
  MAX_PPI,
  MIN_PPI,
  convertLength,
  roundUnit,
  type DesignUnit,
} from './units';
import { designFontIds, type DesignFontId } from './fonts';
import { sanitizeSvg } from './sanitize';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const inset = z
  .object({
    top: z.number().min(0).max(200),
    right: z.number().min(0).max(200),
    bottom: z.number().min(0).max(200),
    left: z.number().min(0).max(200),
  })
  .strict();

export const designPageSchema = z
  .object({
    width: z.number().positive().max(2000),
    height: z.number().positive().max(2000),
    unit: z.enum(['mm', 'in', 'px']),
    ppi: z.number().int().min(MIN_PPI).max(MAX_PPI).default(DEFAULT_PPI),
    bleed: inset.default({ top: 0, right: 0, bottom: 0, left: 0 }),
    safe: inset.default({ top: 0, right: 0, bottom: 0, left: 0 }),
    dimensionSource: z.enum(['verified', 'supplied', 'unconfirmed']),
    dimensionNote: z.string().trim().max(240).default(''),
    background: hex.default('#080A0B'),
  })
  .strict()
  .superRefine((page, ctx) => {
    if (page.unit === 'px' && (page.width > 8000 || page.height > 8000))
      ctx.addIssue({
        code: 'custom',
        message: 'Pixel canvases are limited to 8,000 on each edge.',
      });
    const edges = ['top', 'right', 'bottom', 'left'] as const;
    for (const edge of edges) {
      if (page.bleed[edge] + page.safe[edge] >= (edge === 'left' || edge === 'right' ? page.width : page.height) / 2)
        ctx.addIssue({
          code: 'custom',
          message: 'Bleed and safe area leave no usable trim.',
        });
    }
  });

const layerBase = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  parentId: z.uuid().nullable().default(null),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().max(2000),
  height: z.number().positive().max(2000),
  rotation: z.number().min(-360).max(360).default(0),
});

export const textLayerSchema = layerBase
  .extend({
    type: z.literal('text'),
    content: z.string().max(4000),
    fontId: z.enum(designFontIds),
    fontSize: z.number().positive().max(400),
    fontWeight: z.union([z.literal(400), z.literal(600), z.literal(700)]).default(400),
    align: z.enum(['left', 'center', 'right']).default('left'),
    letterSpacing: z.number().min(-10).max(40).default(0),
    lineHeight: z.number().min(0.8).max(3).default(1.2),
    fill: hex.default('#E6E7E2'),
  })
  .strict();

export const imageLayerSchema = layerBase
  .extend({
    type: z.literal('image'),
    assetId: z.uuid(),
    assetKind: z.enum(['version', 'reference']),
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().positive().max(1),
        height: z.number().positive().max(1),
      })
      .strict()
      .default({ x: 0, y: 0, width: 1, height: 1 })
      .refine((crop) => crop.x + crop.width <= 1.0001 && crop.y + crop.height <= 1.0001, {
        message: 'Crop must stay inside the image.',
      }),
  })
  .strict();

export const svgLayerSchema = layerBase
  .extend({
    type: z.literal('svg'),
    markup: z.string().min(1).max(65536),
  })
  .strict();

export const shapeLayerSchema = layerBase
  .extend({
    type: z.enum(['rect', 'ellipse']),
    fill: hex.default('#0B3B32'),
    stroke: hex.nullable().default(null),
    strokeWidth: z.number().min(0).max(40).default(0),
    cornerRadius: z.number().min(0).max(400).default(0),
  })
  .strict();

export const groupLayerSchema = layerBase.extend({ type: z.literal('group') }).strict();

export const designLayerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
  svgLayerSchema,
  shapeLayerSchema,
  groupLayerSchema,
]);

export const designDocumentSchema = z
  .object({
    schema: z.literal('studio-design/v1'),
    id: z.uuid(),
    title: z.string().trim().min(1).max(80),
    page: designPageSchema,
    layers: z.array(designLayerSchema).max(40),
    guides: z
      .object({
        trim: z.boolean().default(true),
        bleed: z.boolean().default(true),
        safe: z.boolean().default(true),
      })
      .strict()
      .default({ trim: true, bleed: true, safe: true }),
  })
  .strict()
  .superRefine((document, ctx) => {
    const ids = new Set<string>();
    for (const layer of document.layers) {
      if (ids.has(layer.id))
        ctx.addIssue({ code: 'custom', message: 'Layer IDs must be unique.' });
      ids.add(layer.id);
      if (layer.parentId && !document.layers.some((item) => item.id === layer.parentId && item.type === 'group'))
        ctx.addIssue({ code: 'custom', message: `Layer ${layer.name} points at an unknown group.` });
      if (layer.parentId === layer.id)
        ctx.addIssue({ code: 'custom', message: 'A layer cannot parent itself.' });
    }
  });

export type DesignPage = z.infer<typeof designPageSchema>;
export type DesignLayer = z.infer<typeof designLayerSchema>;
export type TextLayer = z.infer<typeof textLayerSchema>;
export type ImageLayer = z.infer<typeof imageLayerSchema>;
export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type DimensionSource = DesignPage['dimensionSource'];

export const MAX_DESIGN_BYTES = 524_288;

export function parseDesignDocument(value: unknown): DesignDocument {
  const encoded = new TextEncoder().encode(JSON.stringify(value)).length;
  if (encoded > MAX_DESIGN_BYTES) throw new Error('This design document is too large to save.');
  const parsed = designDocumentSchema.parse(value);
  return {
    ...parsed,
    layers: parsed.layers.map((layer) =>
      layer.type === 'svg' ? { ...layer, markup: sanitizeSvg(layer.markup) } : layer,
    ),
  };
}

export function convertDocumentUnits(document: DesignDocument, unit: DesignUnit): DesignDocument {
  const from = document.page.unit;
  const ppi = document.page.ppi;
  if (from === unit) return cloneDocument(document);
  const n = (value: number) => roundUnit(convertLength(value, from, unit, ppi), unit);
  const inset = (box: DesignPage['bleed']) => ({
    top: n(box.top),
    right: n(box.right),
    bottom: n(box.bottom),
    left: n(box.left),
  });
  return parseDesignDocument({
    ...document,
    page: {
      ...document.page,
      unit,
      width: n(document.page.width),
      height: n(document.page.height),
      bleed: inset(document.page.bleed),
      safe: inset(document.page.safe),
    },
    layers: document.layers.map((layer) => ({
      ...layer,
      x: n(layer.x),
      y: n(layer.y),
      width: Math.max(unit === 'px' ? 1 : 0.01, n(layer.width)),
      height: Math.max(unit === 'px' ? 1 : 0.01, n(layer.height)),
      ...(layer.type === 'rect' || layer.type === 'ellipse'
        ? {
            strokeWidth: n(layer.strokeWidth),
            cornerRadius: n(layer.cornerRadius),
          }
        : {}),
    })),
  });
}

export function ancestorsLocked(document: DesignDocument, layerId: string) {
  let current = layerById(document, layerId);
  while (current) {
    if (current.locked) return true;
    if (!current.parentId) return false;
    current = document.layers.find((item) => item.id === current.parentId)!;
    if (!current) return false;
  }
  return false;
}

export function ancestorsVisible(document: DesignDocument, layerId: string) {
  let current = layerById(document, layerId);
  while (current) {
    if (!current.visible) return false;
    if (!current.parentId) return true;
    current = document.layers.find((item) => item.id === current.parentId)!;
    if (!current) return false;
  }
  return true;
}

export function cloneDocument(document: DesignDocument): DesignDocument {
  return parseDesignDocument(JSON.parse(JSON.stringify(document)));
}

export function layerById(document: DesignDocument, id: string) {
  const layer = document.layers.find((item) => item.id === id);
  if (!layer) throw new Error('That layer is not in this document.');
  return layer;
}

export function visibleOrder(document: DesignDocument) {
  return document.layers.filter((layer) => {
    if (!layer.visible) return false;
    let parent = layer.parentId;
    while (parent) {
      const group = document.layers.find((item) => item.id === parent);
      if (!group || !group.visible) return false;
      parent = group.parentId;
    }
    return true;
  });
}

export function emptyDocument(input: {
  id: string;
  title: string;
  width: number;
  height: number;
  unit: DesignUnit;
  dimensionSource: DimensionSource;
  dimensionNote?: string;
  ppi?: number;
}): DesignDocument {
  return parseDesignDocument({
    schema: 'studio-design/v1',
    id: input.id,
    title: input.title,
    page: {
      width: input.width,
      height: input.height,
      unit: input.unit,
      ppi: input.ppi ?? DEFAULT_PPI,
      bleed: { top: 0, right: 0, bottom: 0, left: 0 },
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      dimensionSource: input.dimensionSource,
      dimensionNote: input.dimensionNote ?? '',
      background: '#080A0B',
    },
    layers: [],
    guides: { trim: true, bleed: true, safe: true },
  });
}

export function usedFontIds(document: DesignDocument): DesignFontId[] {
  return [
    ...new Set(
      document.layers
        .filter((layer): layer is TextLayer => layer.type === 'text')
        .map((layer) => layer.fontId),
    ),
  ];
}
