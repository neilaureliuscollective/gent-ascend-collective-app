import type { CompositionScene } from './model';

/**
 * Preview crop box matching FFmpeg `crop=iw*w:ih*h:iw*x:ih*y`.
 * CSS `marginTop` percentages are width-relative; `top` percentages are height-relative
 * and share the renderer’s `ih` reference for non-square media.
 */
export function cropPreviewBox(crop: CompositionScene['crop']) {
  const widthPct = 100 / crop.width;
  const heightPct = 100 / crop.height;
  return {
    widthPct,
    heightPct,
    leftPct: -crop.x * widthPct,
    topPct: -crop.y * heightPct,
  };
}

export function cropPreviewStyle(crop: CompositionScene['crop']) {
  const box = cropPreviewBox(crop);
  return {
    position: 'absolute' as const,
    width: `${box.widthPct}%`,
    height: `${box.heightPct}%`,
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    objectFit: 'fill' as const,
    maxWidth: 'none' as const,
  };
}
