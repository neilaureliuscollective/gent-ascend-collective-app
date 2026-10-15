import type { CompositionDocument, CompositionScene } from './model';

export const COMPOSITION_FPS = 24;
export const DISSOLVE_MS = 250;

export function sceneFrames(durationMs: number) {
  return Math.max(1, Math.round((durationMs / 1000) * COMPOSITION_FPS));
}

export function sceneDissolveMs(scene: CompositionScene, index: number) {
  if (index === 0 || scene.transition !== 'dissolve') return 0;
  return Math.min(DISSOLVE_MS, Math.max(0, scene.durationMs - 40), Math.max(0, scene.durationMs));
}

/** Editorial scene starts on a sequential clock before dissolve overlap is applied. */
export function sceneEditorialStartMs(document: CompositionDocument, index: number) {
  return document.scenes.slice(0, index).reduce((sum, scene) => sum + scene.durationMs, 0);
}

/** Playback clock used by preview and FFmpeg. Dissolves overlap adjacent scenes. */
export function scenePlaybackStartMs(document: CompositionDocument, index: number) {
  let start = 0;
  for (let i = 0; i < index; i++) {
    start += document.scenes[i]!.durationMs - sceneDissolveMs(document.scenes[i + 1]!, i + 1);
  }
  return start;
}

export function compositionPlaybackMs(document: CompositionDocument) {
  if (!document.scenes.length) return 0;
  return scenePlaybackStartMs(document, document.scenes.length - 1) + document.scenes.at(-1)!.durationMs;
}

export function activeScenesAt(document: CompositionDocument, timeMs: number) {
  const active: { scene: CompositionScene; index: number; localMs: number; mix: number }[] = [];
  document.scenes.forEach((scene, index) => {
    const start = scenePlaybackStartMs(document, index);
    const end = start + scene.durationMs;
    if (timeMs + 0.5 < start || timeMs > end) return;
    const overlap = sceneDissolveMs(scene, index);
    const localMs = timeMs - start;
    let mix = 1;
    if (overlap > 0 && localMs < overlap) mix = Math.min(1, Math.max(0, localMs / overlap));
    active.push({ scene, index, localMs, mix });
  });
  return active;
}
