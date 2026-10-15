import type { BrandKit } from '../brand';
import { emptyDocument, parseDesignDocument, type DesignDocument, type DesignLayer } from './document';
import { DEFAULT_PPI } from './units';

export type DesignPreset = {
  id: string;
  title: string;
  note: string;
  document: {
    schema: 'studio-design/v1';
    title: string;
    page: DesignDocument['page'];
  };
};

function page(
  width: number,
  height: number,
  unit: 'mm' | 'in' | 'px',
  source: 'verified' | 'supplied' | 'unconfirmed',
  note: string,
  extras: Partial<DesignDocument['page']> = {},
) {
  return {
    width,
    height,
    unit,
    ppi: unit === 'px' ? 72 : DEFAULT_PPI,
    bleed: { top: 0, right: 0, bottom: 0, left: 0 },
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    dimensionSource: source,
    dimensionNote: note,
    background: '#080A0B',
    ...extras,
  };
}

export const designPresets: DesignPreset[] = [
  {
    id: 'custom-print',
    title: 'Custom print',
    note: 'Enter the die or sheet size from your printer or supplier.',
    document: {
      schema: 'studio-design/v1',
      title: 'Custom print',
      page: page(100, 100, 'mm', 'supplied', 'User-supplied print size. Confirm against the printer specification.'),
    },
  },
  {
    id: 'unconfirmed-label',
    title: 'Product label',
    note: 'Dimensions stay unconfirmed until you enter a printer or supplier die size.',
    document: {
      schema: 'studio-design/v1',
      title: 'Product label',
      page: page(
        100,
        70,
        'mm',
        'unconfirmed',
        'Placeholder canvas only. Do not send to print until you replace this with a verified die size.',
        {
          bleed: { top: 2, right: 2, bottom: 2, left: 2 },
          safe: { top: 3, right: 3, bottom: 3, left: 3 },
        },
      ),
    },
  },
  {
    id: 'iso-id1',
    title: 'ISO ID-1 card',
    note: 'ISO/IEC 7810 ID-1: 85.60 × 53.98 mm. Credit-card / business-card format, not a bottle die.',
    document: {
      schema: 'studio-design/v1',
      title: 'ID-1 card',
      page: page(
        85.6,
        53.98,
        'mm',
        'verified',
        'ISO/IEC 7810 ID-1 (85.60 × 53.98 mm). Not a bottle-label specification.',
        {
          bleed: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
          safe: { top: 3, right: 3, bottom: 3, left: 3 },
        },
      ),
    },
  },
  {
    id: 'iso-a4',
    title: 'ISO A4',
    note: 'ISO 216 A4: 210 × 297 mm.',
    document: {
      schema: 'studio-design/v1',
      title: 'A4 sheet',
      page: page(210, 297, 'mm', 'verified', 'ISO 216 A4 (210 × 297 mm).'),
    },
  },
  {
    id: 'us-letter',
    title: 'US Letter',
    note: 'ANSI Letter: 8.5 × 11 in.',
    document: {
      schema: 'studio-design/v1',
      title: 'Letter sheet',
      page: page(8.5, 11, 'in', 'verified', 'ANSI/ASME Y14.1 Letter (8.5 × 11 in).'),
    },
  },
  {
    id: 'finish-square',
    title: 'Finish square',
    note: 'Former Finish square export: 1080 × 1080 px digital canvas.',
    document: {
      schema: 'studio-design/v1',
      title: 'Square finish',
      page: page(1080, 1080, 'px', 'verified', 'Existing Studio Finish square pixel canvas (1080 × 1080).'),
    },
  },
  {
    id: 'finish-portrait',
    title: 'Finish portrait',
    note: 'Former Finish portrait export: 1080 × 1350 px digital canvas.',
    document: {
      schema: 'studio-design/v1',
      title: 'Portrait finish',
      page: page(1080, 1350, 'px', 'verified', 'Existing Studio Finish portrait pixel canvas (1080 × 1350).'),
    },
  },
  {
    id: 'finish-landscape',
    title: 'Finish landscape',
    note: 'Former Finish landscape export: 1920 × 1080 px digital canvas.',
    document: {
      schema: 'studio-design/v1',
      title: 'Landscape finish',
      page: page(1920, 1080, 'px', 'verified', 'Existing Studio Finish landscape pixel canvas (1920 × 1080).'),
    },
  },
  {
    id: 'brand-mark',
    title: 'Brand graphic',
    note: 'Square identity lockup. Edit type and artwork; do not bake required copy into a generated image.',
    document: {
      schema: 'studio-design/v1',
      title: 'Brand graphic',
      page: page(1080, 1080, 'px', 'verified', 'Digital identity canvas (1080 × 1080 px).'),
    },
  },
];

export function presetDocument(presetId: string, id: string, brand?: BrandKit): DesignDocument {
  const preset = designPresets.find((item) => item.id === presetId);
  if (!preset) throw new Error('Unknown design starting point.');
  const document = emptyDocument({
    id,
    title: preset.document.title,
    width: preset.document.page.width,
    height: preset.document.page.height,
    unit: preset.document.page.unit,
    dimensionSource: preset.document.page.dimensionSource,
    dimensionNote: preset.document.page.dimensionNote,
    ppi: preset.document.page.ppi,
  });
  document.page = { ...document.page, ...preset.document.page, background: brand?.background ?? document.page.background };
  return parseDesignDocument(document);
}

export function finishLayoutPreset(
  id: string,
  layout: {
    format: 'square' | 'portrait' | 'landscape';
    treatment: 'editorial' | 'centered' | 'quiet';
    brand: string;
    headline: string;
    supporting: string;
    footer: string;
  },
  brand?: BrandKit,
): DesignDocument {
  const sizes = {
    square: { width: 1080, height: 1080, preset: 'finish-square' },
    portrait: { width: 1080, height: 1350, preset: 'finish-portrait' },
    landscape: { width: 1920, height: 1080, preset: 'finish-landscape' },
  } as const;
  const size = sizes[layout.format];
  const document = presetDocument(size.preset, id, brand);
  document.title = layout.headline.trim() || document.title;
  const fill = brand?.foreground ?? '#E6E7E2';
  const accent = brand?.accent ?? '#C4912F';
  const layers: DesignLayer[] = [];
  const add = (layer: DesignLayer) => layers.push(layer);
  const editorial = layout.treatment === 'editorial';
  add({
    id: crypto.randomUUID(),
    type: 'text',
    name: 'Brand',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: editorial ? 72 : size.width * 0.1,
    y: editorial ? 64 : 80,
    width: size.width * 0.8,
    height: 48,
    rotation: 0,
    content: layout.brand,
    fontId: 'sora',
    fontSize: 18,
    fontWeight: 600,
    align: layout.treatment === 'centered' ? 'center' : 'left',
    letterSpacing: 2,
    lineHeight: 1.1,
    fill: accent,
  });
  add({
    id: crypto.randomUUID(),
    type: 'text',
    name: 'Headline',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: editorial ? 72 : size.width * 0.1,
    y: editorial ? size.height * 0.58 : size.height * 0.42,
    width: size.width * 0.8,
    height: 160,
    rotation: 0,
    content: layout.headline,
    fontId: 'inter',
    fontSize: layout.treatment === 'quiet' ? 42 : 56,
    fontWeight: 600,
    align: layout.treatment === 'centered' ? 'center' : 'left',
    letterSpacing: 0,
    lineHeight: 1.15,
    fill,
  });
  add({
    id: crypto.randomUUID(),
    type: 'text',
    name: 'Supporting',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: editorial ? 72 : size.width * 0.1,
    y: editorial ? size.height * 0.78 : size.height * 0.68,
    width: size.width * 0.8,
    height: 90,
    rotation: 0,
    content: layout.supporting,
    fontId: 'inter',
    fontSize: 22,
    fontWeight: 400,
    align: layout.treatment === 'centered' ? 'center' : 'left',
    letterSpacing: 0,
    lineHeight: 1.3,
    fill,
  });
  add({
    id: crypto.randomUUID(),
    type: 'text',
    name: 'Footer',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: editorial ? 72 : size.width * 0.1,
    y: size.height - 90,
    width: size.width * 0.8,
    height: 36,
    rotation: 0,
    content: layout.footer,
    fontId: 'inter',
    fontSize: 16,
    fontWeight: 400,
    align: layout.treatment === 'centered' ? 'center' : 'left',
    letterSpacing: 0.5,
    lineHeight: 1.2,
    fill,
  });
  document.layers = layers.filter((layer) => layer.type !== 'text' || layer.content.trim());
  return parseDesignDocument(document);
}
