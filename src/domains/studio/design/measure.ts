import { readFile } from 'node:fs/promises';
import fontkit, { type Font } from '@pdf-lib/fontkit';
const createFont = (fontkit as unknown as { create: (bytes: Uint8Array) => Font }).create;
import { designFont, designFontPath, fontSupportsWeight, type DesignFontId, type DesignFontWeight } from './fonts';
import type { TextLayer } from './document';
import { toInches } from './units';
import { rasterizeSvgMarkup } from './raster';

const cache = new Map<DesignFontId, Font>();
const weightScale = new Map<string, number>();

export async function loadDesignFont(id: DesignFontId, weight: DesignFontWeight = 400): Promise<Font> {
  if (!fontSupportsWeight(id, weight))
    throw new Error(`${id} does not include a real ${weight} instance. Studio will not substitute another face.`);
  const hit = cache.get(id);
  if (hit) return hit;
  const bytes = await readFile(designFontPath(id));
  const font = createFont(bytes);
  cache.set(id, font);
  return font;
}

/**
 * @pdf-lib/fontkit getVariation is broken for these WOFF2 files. Measurement uses the
 * real CSS/SVG weight via librsvg instead of treating 600/700 as the regular face.
 */
export async function weightAdvanceScale(id: DesignFontId, weight: DesignFontWeight): Promise<number> {
  if (weight === 400) return 1;
  if (!fontSupportsWeight(id, weight))
    throw new Error(`${id} does not include a real ${weight} instance. Studio will not substitute another face.`);
  const key = `${id}:${weight}`;
  const cached = weightScale.get(key);
  if (cached) return cached;
  const spec = designFont(id);
  const bytes = await readFile(designFontPath(id));
  const mime = spec.file.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
  const fmt = mime === 'font/woff2' ? 'woff2' : 'truetype';
  const probe = async (requested: DesignFontWeight) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="96"><defs><style>@font-face{font-family:${JSON.stringify(spec.family)};src:url("data:${mime};base64,${Buffer.from(bytes).toString('base64')}") format("${fmt}");font-weight:100 900;}</style></defs><text x="8" y="64" font-family="${spec.family.replace(/"/g, '')}" font-size="56" font-weight="${requested}">Aethelios</text></svg>`;
    const png = await rasterizeSvgMarkup(svg, 720, 96);
    let min = 720;
    let max = 0;
    for (let i = 0; i < png.length; i += 4) {
      if (png[i + 3]! < 16) continue;
      const pixel = i / 4;
      const x = pixel % 720;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    return Math.max(1, max - min);
  };
  const regular = await probe(400);
  const requested = await probe(weight);
  if (regular < 8 || requested < 8)
    throw new Error(
      `Could not measure ${id} weight ${weight} from the real face. Studio will not substitute a regular instance.`,
    );
  const scale = requested / regular;
  weightScale.set(key, scale);
  return scale;
}

export function wrapText(layer: TextLayer, font: Font, boxWidthInches: number, advanceScale = 1) {
  const scale = (layer.fontSize / font.unitsPerEm) * advanceScale;
  const space = font.layout(' ').glyphs[0]?.advanceWidth ?? font.unitsPerEm * 0.3;
  const words = layer.content.replace(/\r/g, '').split(/(\s+)/);
  const lines: string[] = [];
  let current = '';
  let width = 0;
  const limit = boxWidthInches * 72;
  const advance = (text: string) => {
    const run = font.layout(text);
    return run.glyphs.reduce((sum, glyph, index) => {
      const position = run.positions[index];
      return sum + ((position?.xAdvance ?? glyph.advanceWidth) + layer.letterSpacing / scale) * scale;
    }, 0);
  };
  for (const token of words) {
    if (token === '') continue;
    if (token.includes('\n')) {
      const parts = token.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push(current);
          current = '';
          width = 0;
        }
        const piece = parts[i]!;
        if (!piece) continue;
        const nextWidth = width + (current ? space * scale : 0) + advance(piece);
        if (current && nextWidth > limit) {
          lines.push(current);
          current = piece;
          width = advance(piece);
        } else {
          current = current ? `${current}${piece}` : piece;
          width = nextWidth;
        }
      }
      continue;
    }
    if (/^\s+$/.test(token)) continue;
    const nextWidth = width + (current ? space * scale : 0) + advance(token);
    if (current && nextWidth > limit) {
      lines.push(current);
      current = token;
      width = advance(token);
    } else {
      current = current ? `${current} ${token}` : token;
      width = current === token ? advance(token) : nextWidth;
    }
  }
  if (current || !lines.length) lines.push(current);
  const lineAdvance = layer.fontSize * layer.lineHeight;
  const heights = lines.length * lineAdvance;
  const widths = lines.map((line) => advance(line));
  return { lines, widths, heights, lineAdvance };
}

export async function measureTextLayer(
  layer: TextLayer,
  unit: 'mm' | 'in' | 'px',
  ppi: number,
) {
  const font = await loadDesignFont(layer.fontId, layer.fontWeight);
  const advanceScale = await weightAdvanceScale(layer.fontId, layer.fontWeight);
  const missing: string[] = [];
  for (const char of layer.content) {
    if (char === '\n' || char === ' ') continue;
    const code = char.codePointAt(0);
    if (code && !font.hasGlyphForCodePoint(code)) missing.push(char);
  }
  if (missing.length)
    throw new Error(
      `Font ${font.fullName ?? layer.fontId} cannot render: ${[...new Set(missing)].slice(0, 12).join(' ')}`,
    );
  const box = wrapText(layer, font, toInches(layer.width, unit, ppi), advanceScale);
  const boxHeight = toInches(layer.height, unit, ppi) * 72;
  return {
    ...box,
    overflow: box.widths.some((width) => width > toInches(layer.width, unit, ppi) * 72 + 0.5) || box.heights > boxHeight + 0.5,
    fontName: font.fullName ?? font.familyName ?? layer.fontId,
  };
}
