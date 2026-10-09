import { describe, expect, it } from 'vitest';
import palette from '../src/platform/visual/aether-palette.json';
function luminance(hex: string) {
  const values = [1, 3, 5].map((offset) => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
describe('Public Aethelios readable materials', () => {
  it('keeps normal text readable on all reading surfaces', () => {
    for (const background of [
      palette.obsidian,
      palette.midnight,
      palette.surface,
      palette.elevated,
      palette.deep,
    ]) {
      for (const text of [palette.text, palette.silver]) {
        expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps active labels, quiet text and premium accents readable in their intended roles', () => {
    expect(contrast(palette.text, palette.petrol)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.muted, palette.obsidian)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.gold, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.luminous, palette.obsidian)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.silver, palette.petrol)).toBeGreaterThanOrEqual(3);
  });
  it('keeps ivory reading surfaces and gold actions readable', () => {
    for (const background of [palette.ivory, palette.cream, '#FBF8F2', '#DFE8DD']) {
      for (const foreground of [palette.ink, palette.quiet, palette.mineral]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(palette.ink, palette.gold)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.gold, palette.obsidian)).toBeGreaterThanOrEqual(4.5);
  });
});
