import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brand } from '@/platform/brand';

describe('Human Ascendance in-app identity', () => {
  it('uses the 2026-10-15 lockup and compact crest, not the retired circular emblem', () => {
    expect(brand.crest).toBe('/brand/aethelios-human-ascendance-20261015-crest.webp');
    expect(brand.lockup).toBe('/brand/aethelios-human-ascendance-20261015-lockup.webp');
    expect(brand.crest).not.toBe(brand.lockup);
    expect(brand.lockupAlt).toMatch(/Human Ascendance/i);
    expect(
      readFileSync('public/brand/aethelios-human-ascendance-20261015-master.png').length,
    ).toBeGreaterThan(1_000_000);
  });

  it('leaves the installable application icon on the official gold-A files', () => {
    const icons = readFileSync('scripts/current-app-icons.mjs', 'utf8');
    const manifest = readFileSync('src/app/manifest.ts', 'utf8');
    expect(icons).toContain("const SOURCE = 'public/brand/aethelios-official-20261015-source.png'");
    expect(icons).not.toContain('human-ascendance');
    expect(manifest).toContain('/brand/aethelios-official-20261015-192.png');
    expect(manifest).toContain('/brand/aethelios-official-20261015-maskable-512.png');
    expect(manifest).not.toContain('human-ascendance');
  });
});
