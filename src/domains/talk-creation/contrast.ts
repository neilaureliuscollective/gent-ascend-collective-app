import { hexColor, paletteSwatchSchema, type PaletteContent } from './schema';
import type { z } from 'zod';

type Swatch = z.infer<typeof paletteSwatchSchema>;

function channel(value: number) {
  const next = value / 255;
  return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const parsed = hexColor.safeParse(hex);
  if (!parsed.success) return null;
  const raw = parsed.data.slice(1);
  const r = channel(Number.parseInt(raw.slice(0, 2), 16));
  const g = channel(Number.parseInt(raw.slice(2, 4), 16));
  const b = channel(Number.parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

const textRoles = new Set(['text', 'accent', 'highlight', 'muted']);
const groundRoles = new Set(['background', 'surface']);

export function paletteContrast(swatches: Swatch[]): PaletteContent['contrast'] {
  const pairs: PaletteContent['contrast'] = [];
  const grounds = swatches.filter((swatch) => groundRoles.has(swatch.role));
  const inks = swatches.filter((swatch) => textRoles.has(swatch.role));
  const backgrounds = grounds.length ? grounds : swatches.slice(0, 1);
  const foregrounds = inks.length ? inks : swatches.slice(1, 3);
  for (const ground of backgrounds) {
    for (const ink of foregrounds) {
      if (ground.hex.toLowerCase() === ink.hex.toLowerCase()) continue;
      const ratio = contrastRatio(ink.hex, ground.hex);
      if (ratio === null) continue;
      pairs.push({
        foreground: ink.hex,
        background: ground.hex,
        ratio,
        pair: `${ink.name} on ${ground.name}`,
        passesAa: ratio >= 4.5,
      });
      if (pairs.length >= 16) return pairs;
    }
  }
  return pairs;
}

export function withCalculatedContrast<T extends { swatches: Swatch[]; contrast?: PaletteContent['contrast'] }>(
  palette: T,
): T & { contrast: PaletteContent['contrast'] } {
  return { ...palette, contrast: paletteContrast(palette.swatches) };
}
