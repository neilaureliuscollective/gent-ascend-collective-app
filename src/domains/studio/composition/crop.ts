import type { CompositionScene } from './model';

export type CropBox = CompositionScene['crop'];

/**
 * Preview and FFmpeg share crop-then-cover:
 * 1. Take the source rectangle (crop.x/y/width/height) in source fractions.
 * 2. Scale that rectangle so it covers the placement box
 *    (`object-fit: cover` / `force_original_aspect_ratio=increase` then crop).
 * CSS `object-view-box` selects the crop rectangle from the intrinsic image;
 * `object-fit: cover` then covers placement. This is not `object-fit: fill`.
 */
export function cropPreviewBox(crop: CropBox) {
  const widthPct = 100 / crop.width;
  const heightPct = 100 / crop.height;
  return {
    widthPct,
    heightPct,
    leftPct: -crop.x * widthPct,
    topPct: -crop.y * heightPct,
  };
}

export function cropViewBox(crop: CropBox) {
  return `xywh(${crop.x * 100}% ${crop.y * 100}% ${crop.width * 100}% ${crop.height * 100}%)`;
}

export function cropPreviewStyle(crop: CropBox) {
  return {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectViewBox: cropViewBox(crop),
    maxWidth: 'none' as const,
  };
}

/** Source pixels visible after crop-then-cover into a placement box. FFmpeg centre-crops the scaled result. */
export function coverAfterCropSourceRect(
  crop: CropBox,
  source: { width: number; height: number },
  place: { width: number; height: number },
) {
  const croppedW = source.width * crop.width;
  const croppedH = source.height * crop.height;
  const scale = Math.max(place.width / Math.max(1, croppedW), place.height / Math.max(1, croppedH));
  const visW = place.width / scale;
  const visH = place.height / scale;
  const overflowX = Math.max(0, croppedW - visW);
  const overflowY = Math.max(0, croppedH - visH);
  return {
    x: source.width * crop.x + overflowX / 2,
    y: source.height * crop.y + overflowY / 2,
    width: visW,
    height: visH,
    scale,
  };
}
