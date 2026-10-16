/** Sphere math for the Live globe. Screen y increases downward, so north is -ny. */

export function clampUnit(value: number) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export function liveGlobeMapUv(lon: number, lat: number) {
  const tau = Math.PI * 2;
  const u = ((lon + Math.PI) / tau + 1) % 1;
  const v = 0.5 - lat / Math.PI;
  return { u, v: Math.max(0, Math.min(1, v)) };
}

/** Convert disk coordinates to geographic radians. `ny` is screen-down. */
export function liveGlobeSphereCoords(nx: number, ny: number, rotation = 0) {
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const r2 = nx * nx + ny * ny;
  if (r2 > 1) return null;
  const x = nx;
  const y = ny;
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = x * cos + nz * sin;
  const rz = -x * sin + nz * cos;
  return {
    lon: Math.atan2(rx, rz),
    lat: Math.asin(clampUnit(-y)),
    facing: nz,
  };
}

/** Project a landmark onto the facing disk, or null when it is on the far side. */
export function liveGlobeLandmarkScreen(latDeg: number, lonDeg: number, rotation = 0) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180 - rotation;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  if (z <= 0.02) return null;
  return { nx: x, ny: -y, facing: z };
}

export const liveGlobeLandmarks = {
  greenland: { name: 'Greenland', lat: 72, lon: -40 },
  scandinavia: { name: 'Scandinavia', lat: 63, lon: 15 },
  tasmania: { name: 'Tasmania', lat: -42, lon: 147 },
  capeHorn: { name: 'Cape Horn', lat: -55, lon: -68 },
} as const;
