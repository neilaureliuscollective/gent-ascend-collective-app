import { biomarkerSeries, comparisonKey, numeric } from './trends';
import type { SavedObservation } from './schema';
import type { BloodworkSettings } from './workspace-model';

export type BloodworkMarker = ReturnType<typeof biomarkerSeries>[number] & {
  selected: boolean;
};

export function formatReportedValue(value: string) {
  const parsed = numeric(value);
  if (parsed === null) return value;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(parsed);
}

export function formatMeasuredNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function filterObservations(observations: SavedObservation[], settings: BloodworkSettings) {
  return observations.filter((row) => {
    if (row.status !== 'active') return false;
    if (settings.dateFrom && row.date < settings.dateFrom) return false;
    if (settings.dateTo && row.date > settings.dateTo) return false;
    if (!settings.markerKeys.length) return false;
    return settings.markerKeys.includes(comparisonKey(row));
  });
}

export function bloodworkWorkspace(
  observations: SavedObservation[],
  settings: BloodworkSettings,
  sample: boolean,
) {
  const visible = filterObservations(observations, settings);
  const markers = biomarkerSeries(observations.filter((row) => row.status === 'active')).map(
    (item) => ({
      ...item,
      selected: settings.markerKeys.includes(item.key),
    }),
  );
  const focusKey =
    (settings.focusKey && settings.markerKeys.includes(settings.focusKey)
      ? settings.focusKey
      : null) ??
    settings.markerKeys[0] ??
    null;
  const focus = markers.find((item) => item.key === focusKey) ?? null;
  const chartRows = (focus?.rows ?? []).filter((row) => {
    if (settings.dateFrom && row.date < settings.dateFrom) return false;
    if (settings.dateTo && row.date > settings.dateTo) return false;
    return numeric(row.value) !== null;
  });
  const qualitative = (focus?.rows ?? []).filter((row) => {
    if (settings.dateFrom && row.date < settings.dateFrom) return false;
    if (settings.dateTo && row.date > settings.dateTo) return false;
    return numeric(row.value) === null;
  });
  const comparable = focus && focus.difference !== null ? [focus] : [];
  return {
    sample,
    markers,
    visible,
    focus,
    focusKey,
    chartRows,
    qualitative,
    emptySelection: settings.markerKeys.length === 0,
    comparable,
  };
}

export function toggleMarker(settings: BloodworkSettings, key: string): BloodworkSettings {
  const present = settings.markerKeys.includes(key);
  const markerKeys = present
    ? settings.markerKeys.filter((item) => item !== key)
    : [...settings.markerKeys, key].slice(0, 24);
  const focusKey = present
    ? settings.focusKey === key
      ? (markerKeys[0] ?? null)
      : settings.focusKey
    : key;
  return { ...settings, markerKeys, focusKey };
}

export function selectMarkersByName(
  observations: SavedObservation[],
  names: string[],
): BloodworkSettings['markerKeys'] {
  const wanted = names.map((name) => name.toLowerCase());
  return biomarkerSeries(observations.filter((row) => row.status === 'active'))
    .filter((item) => wanted.some((name) => item.name.toLowerCase().includes(name.split(' ')[0]!)))
    .map((item) => item.key)
    .slice(0, 24);
}

export function initialBloodworkSettings(observations: SavedObservation[]): BloodworkSettings {
  const firstNumeric = biomarkerSeries(observations.filter((row) => row.status === 'active')).find(
    (item) => item.rows.some((row) => numeric(row.value) !== null),
  );
  return {
    ...{
      markerKeys: firstNumeric ? [firstNumeric.key] : [],
      focusKey: firstNumeric?.key ?? null,
      dateFrom: null,
      dateTo: null,
      density: 'comfortable' as const,
      arrangement: 'timeline' as const,
      comparisonDrawer: true,
      dateRange: true,
    },
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

export function projectBridgeObservations(
  observations: SavedObservation[],
  settings: BloodworkSettings | undefined,
  allowed: Set<string>,
) {
  const selected = settings
    ? filterObservations(observations, settings)
    : observations.filter((row) => row.status === 'active');
  return selected.map((row) => {
    const hosted = hostControlledValue(row);
    return Object.fromEntries(
      Object.entries(hosted).filter(([key]) => key === 'id' || key === 'host' || allowed.has(key)),
    );
  });
}
