import { readFileSync } from 'node:fs';
import { decode as decodeJpeg } from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { liveGlobeMapUv } from '../src/platform/visual/live-globe-projection';
import {
  gradeEarth,
  legacyIcePixel,
  settleGlobeEnergy,
} from '../src/platform/visual/live-globe-renderer';

const ICE_GRAY = [90, 102, 100] as const;
const NUBIAN = [255, 243, 185] as const;

function samplePlate(
  jpeg: { width: number; height: number; data: Uint8Array },
  lonDeg: number,
  latDeg: number,
) {
  const { u, v } = liveGlobeMapUv((lonDeg * Math.PI) / 180, (latDeg * Math.PI) / 180);
  const x = Math.min(jpeg.width - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * jpeg.width)));
  const y = Math.min(jpeg.height - 1, Math.max(0, Math.round(v * (jpeg.height - 1))));
  const index = (y * jpeg.width + x) * 4;
  return [jpeg.data[index] ?? 0, jpeg.data[index + 1] ?? 0, jpeg.data[index + 2] ?? 0] as const;
}

describe('live globe earth grade', () => {
  it('treats the Nubian desert sample as legacy ice but not as flat gray now', () => {
    expect(legacyIcePixel(...NUBIAN)).toBe(true);
    const graded = gradeEarth(...NUBIAN);
    expect(graded).not.toEqual(ICE_GRAY);
    expect(graded[1]).toBeGreaterThan(graded[0]);
    expect(graded[1]).toBeGreaterThan(graded[2]);
    expect(graded[0]).toBeGreaterThan(80);
  });

  it('keeps adjacent bright land continuous instead of snapping to ice gray', () => {
    const brighter = gradeEarth(200, 198, 176);
    const dimmer = gradeEarth(188, 186, 164);
    expect(legacyIcePixel(200, 198, 176)).toBe(true);
    expect(legacyIcePixel(188, 186, 164)).toBe(false);
    expect(brighter).not.toEqual(ICE_GRAY);
    expect(Math.abs(brighter[1] - dimmer[1])).toBeLessThan(20);
    expect(Math.abs(brighter[0] - dimmer[0])).toBeLessThan(20);
  });

  it('grades NASA Blue Marble so deserts stay warm emerald and ice stays cooler', () => {
    const jpeg = decodeJpeg(
      readFileSync('public/visual/nasa-blue-marble-land-shallow-topo-2048.jpg'),
      { maxMemoryUsageInMB: 256 },
    );
    let legacyIce = 0;
    let stillGray = 0;
    for (let lat = 18; lat <= 22; lat += 1) {
      for (let lon = 30; lon <= 34; lon += 1) {
        const pixel = samplePlate(jpeg, lon, lat);
        if (legacyIcePixel(...pixel)) legacyIce += 1;
        const graded = gradeEarth(...pixel);
        if (graded[0] === ICE_GRAY[0] && graded[1] === ICE_GRAY[1] && graded[2] === ICE_GRAY[2])
          stillGray += 1;
      }
    }
    expect(legacyIce).toBeGreaterThan(0);
    expect(stillGray).toBe(0);
    const nubian = samplePlate(jpeg, 32, 20);
    const amazon = samplePlate(jpeg, -60, -3);
    const greenland = samplePlate(jpeg, -40, 72);
    const pacific = samplePlate(jpeg, -150, 0);
    const desert = gradeEarth(...nubian);
    const forest = gradeEarth(...amazon);
    const ice = gradeEarth(...greenland);
    const ocean = gradeEarth(...pacific);
    expect(desert).not.toEqual(ICE_GRAY);
    expect(desert[1]).toBeGreaterThan(desert[2]);
    expect(desert[0]).toBeGreaterThan(forest[0]);
    expect(forest[1]).toBeGreaterThan(forest[0]);
    expect(ice[2] - ice[0]).toBeGreaterThan(desert[2] - desert[0]);
    expect(ocean[0]).toBeLessThan(24);
    expect(ocean[1]).toBeLessThan(32);
  });

  it('drops speaking energy immediately and eases listening or speaking', () => {
    const interrupted = settleGlobeEnergy('listening', 'speaking', 0.1, 0.92, 0.22, 0, 1);
    expect(interrupted.shownOut).toBeLessThan(0.02);
    const lingering = settleGlobeEnergy('speaking', 'speaking', 0, 0.92, 0, 0, 1, true);
    expect(lingering.shownOut).toBeGreaterThan(0.9);
    const still = settleGlobeEnergy('listening', 'listening', 0.05, 0, 0.22, 0, 40, false);
    expect(still.shownIn).toBeCloseTo(0.22);
    const waiting = settleGlobeEnergy('waiting', 'speaking', 0, 0.8, 0, 0.12, 8);
    expect(waiting.shownOut).toBeCloseTo(0.12);
    const muted = settleGlobeEnergy('muted', 'listening', 0.2, 0, 0.08, 0, 8);
    expect(muted.shownIn).toBeCloseTo(0.08);
    const blocked = settleGlobeEnergy('blocked', 'speaking', 0, 0.7, 0, 0.1, 8);
    expect(blocked.shownOut).toBeCloseTo(0.1);
  });
});
