import type { SavedObservation, WellnessPoint } from './schema';
import { convertWeight } from '@/domains/performance/fuel';

export function summarize(points: WellnessPoint[]) {
  return {
    count: points.length,
    average: points.length ? points.reduce((n, p) => n + p.value, 0) / points.length : null,
    latest: points.at(-1) ?? null,
  };
}
/** Conservative first phase: matching reported code/name, unit, method and specimen only. */
export function comparisonKey(o: SavedObservation) {
  return JSON.stringify([
    o.code || o.name.toLowerCase(),
    o.unit,
    o.specimen.toLowerCase(),
    o.method.toLowerCase(),
  ]);
}
export function numeric(value: string) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function biomarkerSeries(observations: SavedObservation[]) {
  const groups = new Map<string, SavedObservation[]>();
  for (const o of observations.filter((o) => o.status === 'active')) {
    const key = comparisonKey(o);
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return [...groups].map(([key, rows]) => {
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const latest = rows.at(-1)!;
    const previous = rows.filter((o) => o.date < latest.date).at(-1);
    const a = previous ? numeric(previous.value) : null,
      b = numeric(latest.value);
    // Unknown methods/specimens prevent a numerical longitudinal inference.
    const conflict =
      rows.filter((o) => o.date === latest.date).length > 1 ||
      Boolean(previous && rows.filter((o) => o.date === previous.date).length > 1);
    const comparable =
      !conflict &&
      Boolean(previous && latest.method && latest.specimen && a !== null && b !== null);
    return {
      key,
      name: latest.name,
      rows,
      latest,
      previous,
      difference: comparable ? b! - a! : null,
      limitation: conflict
        ? 'Multiple values share a collection date. Resolve source conflicts before comparing.'
        : comparable
          ? 'A dated difference, not a diagnosis or sustained trend.'
          : 'Method, specimen or comparable dated values are missing. Results remain separate.',
    };
  });
}
export function weightKg(value: number, unit: 'kg' | 'lb') {
  return convertWeight(value, unit, 'kg');
}
