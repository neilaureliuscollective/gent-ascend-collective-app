export type MirrorReading = {
  faces: number;
  outline: { x: number; y: number }[];
  brightness: number;
  turn: number;
};
export function mirrorGuidance(reading: MirrorReading, view: 'front' | 'left' | 'right' | 'hair') {
  if (view === 'hair')
    return { ready: false, text: 'Frame your hair or scalp. Capture when ready.' };
  if (reading.faces !== 1 || reading.outline.length !== 4)
    return {
      ready: false,
      text: reading.faces > 1 ? 'One person in frame.' : 'Bring your face into view.',
    };
  const xs = reading.outline.map((p) => p.x),
    ys = reading.outline.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  if (![width, height, cx, cy, reading.turn, reading.brightness].every(Number.isFinite))
    return { ready: false, text: 'Bring your face into view.' };
  if (width < 0.18 || height < 0.28) return { ready: false, text: 'Move a little closer.' };
  if (height > 0.85 || width > 0.82) return { ready: false, text: 'Move a little farther back.' };
  if (Math.abs(cx - 0.5) > 0.2 || Math.abs(cy - 0.5) > 0.2)
    return { ready: false, text: 'Center your face.' };
  if (reading.brightness < 25) return { ready: false, text: 'Find brighter, even light.' };
  if (reading.brightness > 240) return { ready: false, text: 'Move away from the bright light.' };
  // Positioning heuristics only: no face identity, skin measurements or health scores.
  const aligned =
    view === 'front'
      ? Math.abs(reading.turn - 0.5) < 0.12
      : view === 'left'
        ? reading.turn > 0.65 && reading.turn < 0.9
        : reading.turn < 0.35 && reading.turn > 0.1;
  return {
    ready: aligned,
    text: aligned ? 'Hold steady.' : view === 'front' ? 'Face forward.' : `Turn slightly ${view}.`,
  };
}
export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError')
    return 'Camera permission was blocked. Allow camera access in your browser or app settings, then try again.';
  if (name === 'NotFoundError') return 'No camera was found. Choose existing photos instead.';
  if (name === 'NotReadableError')
    return 'Your camera is busy. Close other camera apps, then try again.';
  return 'Camera could not open. Try again or choose existing photos.';
}
