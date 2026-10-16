import { describe, expect, it } from 'vitest';
import {
  liveGlobeLandmarkScreen,
  liveGlobeLandmarks,
  liveGlobeMapUv,
  liveGlobeSphereCoords,
} from '../src/platform/visual/live-globe-projection';

describe('live globe latitude mapping', () => {
  it('treats the top of the disk as north because screen y increases downward', () => {
    const north = liveGlobeSphereCoords(0, -0.45, 0);
    const south = liveGlobeSphereCoords(0, 0.45, 0);
    expect(north?.lat).toBeGreaterThan(0.4);
    expect(south?.lat).toBeLessThan(-0.4);
    expect(liveGlobeMapUv(0, north!.lat).v).toBeLessThan(liveGlobeMapUv(0, south!.lat).v);
  });

  it('keeps recognizable northern landmarks above southern ones', () => {
    const greenland = liveGlobeLandmarkScreen(
      liveGlobeLandmarks.greenland.lat,
      liveGlobeLandmarks.greenland.lon,
      0,
    );
    const scandinavia = liveGlobeLandmarkScreen(
      liveGlobeLandmarks.scandinavia.lat,
      liveGlobeLandmarks.scandinavia.lon,
      0,
    );
    const horn = liveGlobeLandmarkScreen(
      liveGlobeLandmarks.capeHorn.lat,
      liveGlobeLandmarks.capeHorn.lon,
      0,
    );
    expect(greenland).toBeTruthy();
    expect(scandinavia).toBeTruthy();
    expect(horn).toBeTruthy();
    expect(greenland!.ny).toBeLessThan(0);
    expect(scandinavia!.ny).toBeLessThan(0);
    expect(horn!.ny).toBeGreaterThan(0);
    expect(greenland!.ny).toBeLessThan(horn!.ny);
  });

  it('rejects pixels outside the disk so axis ticks do not paint past the limb', () => {
    expect(liveGlobeSphereCoords(1.25, 0)).toBeNull();
    expect(liveGlobeSphereCoords(-1.4, 0)).toBeNull();
    expect(liveGlobeSphereCoords(0, 1.3)).toBeNull();
    expect(liveGlobeSphereCoords(0, -1.2)).toBeNull();
    expect(liveGlobeSphereCoords(0.2, -0.2)).toBeTruthy();
  });

  it('places Tasmania in the southern hemisphere when Australia faces the camera', () => {
    const rotation = (liveGlobeLandmarks.tasmania.lon * Math.PI) / 180;
    const tasmania = liveGlobeLandmarkScreen(
      liveGlobeLandmarks.tasmania.lat,
      liveGlobeLandmarks.tasmania.lon,
      rotation,
    );
    const greenland = liveGlobeLandmarkScreen(
      liveGlobeLandmarks.greenland.lat,
      liveGlobeLandmarks.greenland.lon,
      rotation,
    );
    expect(tasmania).toBeTruthy();
    expect(tasmania!.ny).toBeGreaterThan(0);
    if (greenland) expect(greenland.ny).toBeLessThan(tasmania!.ny);
  });
});
