import { biomarkerSeries, comparisonKey, numeric } from './trends';
import type { SavedObservation } from './schema';
import type { BloodworkSettings } from './workspace-model';

export type BloodworkMarker = ReturnType<typeof biomarkerSeries>[number] & {
  selected: boolean;
};

export function filterObservations(observations: SavedObservation[], settings: BloodworkSettings) {
  return observations.filter((row) => {
    if (row.status !== 'active') return false;
    if (settings.dateFrom && row.date < settings.dateFrom) return false;
    if (settings.dateTo && row.date > settings.dateTo) return false;
    if (settings.markerKeys.length && !settings.markerKeys.includes(comparisonKey(row)))
      return false;
    return true;
  });
}

export function bloodworkWorkspace(
  observations: SavedObservation[],
  settings: BloodworkSettings,
  sample: boolean,
) {
  const visible = filterObservations(observations, settings);
  const series = biomarkerSeries(sample ? visible : visible).map((item) => ({
    ...item,
    selected: settings.markerKeys.length === 0 || settings.markerKeys.includes(item.key),
  }));
  const markers = biomarkerSeries(observations.filter((row) => row.status === 'active'));
  return {
    sample,
    series,
    markers,
    visible,
    comparable: series.filter((item) => item.difference !== null),
  };
}

export function toggleMarker(settings: BloodworkSettings, key: string): BloodworkSettings {
  const present = settings.markerKeys.includes(key);
  return {
    ...settings,
    markerKeys: present
      ? settings.markerKeys.filter((item) => item !== key)
      : [...settings.markerKeys, key].slice(0, 24),
  };
}

export function hostControlledValue(observation: SavedObservation) {
  return {
    id: observation.id,
    name: observation.name,
    code: observation.code,
    value: observation.value,
    unit: observation.unit,
    date: observation.date,
    specimen: observation.specimen,
    method: observation.method,
    range: observation.range,
    flag: observation.flag,
    numeric: numeric(observation.value),
    host: true as const,
  };
}
