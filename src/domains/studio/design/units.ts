/** Physical document geometry. Export PPI is never screen pixel density. */
export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;
export const MIN_PPI = 72;
export const MAX_PPI = 600;
export const DEFAULT_PPI = 300;
export type DesignUnit = 'mm' | 'in' | 'px';

export function assertPpi(ppi: number) {
  if (!Number.isInteger(ppi) || ppi < MIN_PPI || ppi > MAX_PPI)
    throw new Error('Export resolution must be a whole number between 72 and 600 PPI.');
  return ppi;
}

export function toInches(value: number, unit: DesignUnit, ppi: number): number {
  assertPpi(ppi);
  if (!Number.isFinite(value) || value < 0) throw new Error('A dimension cannot be negative.');
  if (unit === 'in') return value;
  if (unit === 'mm') return value / MM_PER_INCH;
  return value / ppi;
}

export function fromInches(inches: number, unit: DesignUnit, ppi: number): number {
  assertPpi(ppi);
  if (unit === 'in') return inches;
  if (unit === 'mm') return inches * MM_PER_INCH;
  return inches * ppi;
}

export function toPixels(value: number, unit: DesignUnit, ppi: number): number {
  const pixels = toInches(value, unit, ppi) * ppi;
  if (pixels > 20000) throw new Error('This document would exceed the 20,000 pixel export limit.');
  return Math.round(pixels);
}

export function toPoints(value: number, unit: DesignUnit, ppi: number): number {
  return toInches(value, unit, ppi) * POINTS_PER_INCH;
}

export function roundUnit(value: number, unit: DesignUnit): number {
  const places = unit === 'mm' ? 3 : unit === 'in' ? 4 : 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Convert a signed length. Positions may be negative; page size may not. */
export function convertLength(value: number, from: DesignUnit, to: DesignUnit, ppi: number): number {
  assertPpi(ppi);
  if (!Number.isFinite(value)) throw new Error('A dimension must be a finite number.');
  if (from === to) return value;
  const inches = from === 'in' ? value : from === 'mm' ? value / MM_PER_INCH : value / ppi;
  if (to === 'in') return inches;
  if (to === 'mm') return inches * MM_PER_INCH;
  return inches * ppi;
}

export function pointsToPixels(points: number, ppi: number) {
  assertPpi(ppi);
  return points * (ppi / POINTS_PER_INCH);
}

export function glyphScale(fontSizePoints: number, ppi: number, unitsPerEm: number) {
  return pointsToPixels(fontSizePoints, ppi) / unitsPerEm;
}

export function pagePixels(page: {
  width: number;
  height: number;
  unit: DesignUnit;
  ppi: number;
}) {
  return {
    width: toPixels(page.width, page.unit, page.ppi),
    height: toPixels(page.height, page.unit, page.ppi),
  };
}

export function pagePoints(page: {
  width: number;
  height: number;
  unit: DesignUnit;
  ppi: number;
}) {
  return {
    width: toPoints(page.width, page.unit, page.ppi),
    height: toPoints(page.height, page.unit, page.ppi),
  };
}

type PageBox = {
  width: number;
  height: number;
  unit: DesignUnit;
  ppi: number;
  bleed?: { top: number; right: number; bottom: number; left: number };
};

/** Finished trim size is page width/height. Bleed extends media bounds outward. */
export function mediaPixels(page: PageBox) {
  const bleed = page.bleed ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    width: toPixels(page.width + bleed.left + bleed.right, page.unit, page.ppi),
    height: toPixels(page.height + bleed.top + bleed.bottom, page.unit, page.ppi),
    offsetX: toPixels(bleed.left, page.unit, page.ppi),
    offsetY: toPixels(bleed.top, page.unit, page.ppi),
  };
}

export function mediaPoints(page: PageBox) {
  const bleed = page.bleed ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    width: toPoints(page.width + bleed.left + bleed.right, page.unit, page.ppi),
    height: toPoints(page.height + bleed.top + bleed.bottom, page.unit, page.ppi),
    trimWidth: toPoints(page.width, page.unit, page.ppi),
    trimHeight: toPoints(page.height, page.unit, page.ppi),
    left: toPoints(bleed.left, page.unit, page.ppi),
    right: toPoints(bleed.right, page.unit, page.ppi),
    top: toPoints(bleed.top, page.unit, page.ppi),
    bottom: toPoints(bleed.bottom, page.unit, page.ppi),
  };
}

export function mediaInches(page: PageBox) {
  const bleed = page.bleed ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    width: toInches(page.width + bleed.left + bleed.right, page.unit, page.ppi),
    height: toInches(page.height + bleed.top + bleed.bottom, page.unit, page.ppi),
  };
}
