import { readFile } from 'node:fs/promises';
import fontkit, { type Font } from '@pdf-lib/fontkit';
const createFont = (fontkit as unknown as { create: (bytes: Uint8Array) => Font }).create;
import { designFontPath, fontSupportsWeight, type DesignFontId, type DesignFontWeight } from './fonts';
import type { TextLayer } from './document';
import { toInches } from './units';

const cache = new Map<string, Font>();

export async function loadDesignFont(id: DesignFontId, weight: DesignFontWeight = 400): Promise<Font> {
  if (!fontSupportsWeight(id, weight))
    throw new Error(`${id} does not include a real ${weight} instance. Studio will not substitute another face.`);
  const key = `${id}:${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bytes = await readFile(designFontPath(id, weight));
  const font = createFont(bytes);
  cache.set(key, font);
  return font;
}

export function wrapText(layer: TextLayer, font: Font, boxWidthInches: number) {
  const scale = layer.fontSize / font.unitsPerEm;
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
  const box = wrapText(layer, font, toInches(layer.width, unit, ppi));
  const boxHeight = toInches(layer.height, unit, ppi) * 72;
  return {
    ...box,
    overflow: box.widths.some((width) => width > toInches(layer.width, unit, ppi) * 72 + 0.5) || box.heights > boxHeight + 0.5,
    fontName: font.fullName ?? font.familyName ?? layer.fontId,
  };
}
