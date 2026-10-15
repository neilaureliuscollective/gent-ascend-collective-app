'use client';
import { bloodworkWorkspace, toggleMarker } from '@/domains/health/bloodwork';
import {
  sampleBloodwork,
  sampleBloodworkRecord,
  sampleWorkspaceNotice,
} from '@/domains/health/sample';
import type { HealthRecord, SavedObservation } from '@/domains/health/schema';
import { comparisonKey } from '@/domains/health/trends';
import type { BloodworkSettings, SelectedElement } from '@/domains/health/workspace-model';

export function BloodworkTool({
  observations,
  records,
  settings,
  sample,
  selected,
  blocked,
  onSettings,
  onSelect,
}: {
  observations: SavedObservation[];
  records: HealthRecord[];
  settings: BloodworkSettings;
  sample: boolean;
  selected: SelectedElement | null;
  blocked: boolean;
  onSettings: (next: BloodworkSettings) => void;
  onSelect: (next: SelectedElement) => void;
}) {
  const source = sample ? sampleBloodwork : observations;
  const view = bloodworkWorkspace(source, settings, sample);
  const dates = view.visible.map((row) => Date.parse(`${row.date}T12:00:00Z`));
  const values = view.visible.map((row) => Number(row.value)).filter((n) => Number.isFinite(n));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const first = dates.length ? Math.min(...dates) : 0;
  const last = dates.length ? Math.max(...dates) : 1;
  return (
    <div
      className="health-tool"
      data-tool="bloodwork-tracker"
      data-sample={sample}
      data-density={settings.density}
    >
      <header className="health-tool-header">
        <p className="health-kicker">{sample ? 'Sample evidence' : 'Reviewed evidence'}</p>
        <h2>Bloodwork Tracker</h2>
        <p>
          {sample
            ? sampleWorkspaceNotice
            : 'Reviewed observations with original units, collection dates and laboratory ranges.'}
        </p>
      </header>
      <div className="health-toolbar">
        <fieldset disabled={blocked}>
          <legend>Visible markers</legend>
          {view.markers.map((marker) => (
            <label key={marker.key} className="health-chip">
              <input
                type="checkbox"
                checked={
                  settings.markerKeys.length === 0 || settings.markerKeys.includes(marker.key)
                }
                onChange={() =>
                  onSettings(
                    toggleMarker(
                      settings.markerKeys.length
                        ? settings
                        : { ...settings, markerKeys: view.markers.map((item) => item.key) },
                      marker.key,
                    ),
                  )
                }
              />
              {marker.name}
            </label>
          ))}
        </fieldset>
        {settings.dateRange && (
          <fieldset disabled={blocked}>
            <legend>Date range</legend>
            <label>
              From
              <input
                type="date"
                aria-label="From date"
                value={settings.dateFrom ?? ''}
                onChange={(e) => onSettings({ ...settings, dateFrom: e.target.value || null })}
                onFocus={() => onSelect({ kind: 'chart', id: 'range' })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                aria-label="To date"
                value={settings.dateTo ?? ''}
                onChange={(e) => onSettings({ ...settings, dateTo: e.target.value || null })}
              />
            </label>
          </fieldset>
        )}
        <fieldset disabled={blocked}>
          <legend>Arrangement</legend>
          <label>
            <input
              type="radio"
              name="bloodwork-arrangement"
              checked={settings.arrangement === 'timeline'}
              onChange={() => onSettings({ ...settings, arrangement: 'timeline' })}
            />
            Timeline
          </label>
          <label>
            <input
              type="radio"
              name="bloodwork-arrangement"
              checked={settings.arrangement === 'markers'}
              onChange={() => onSettings({ ...settings, arrangement: 'markers' })}
            />
            Markers
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.density === 'compact'}
              onChange={(e) =>
                onSettings({ ...settings, density: e.target.checked ? 'compact' : 'comfortable' })
              }
            />
            Compact density
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.comparisonDrawer}
              onChange={(e) => onSettings({ ...settings, comparisonDrawer: e.target.checked })}
            />
            Comparison drawer
          </label>
        </fieldset>
      </div>
      <div className="health-evidence-layout" data-arrangement={settings.arrangement}>
        <svg
          className="health-chart"
          viewBox="0 0 560 180"
          role="img"
          aria-label="Reviewed marker values over collection dates"
        >
          {view.visible.map((row, index) => {
            const x = 24 + (last === first ? 0.5 : (dates[index]! - first) / (last - first)) * 512;
            const numeric = Number(row.value);
            const y =
              150 -
              (max === min || !Number.isFinite(numeric)
                ? 60
                : ((numeric - min) / (max - min)) * 120);
            return (
              <g key={row.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={selected?.id === row.id ? 6 : 4}
                  className={selected?.id === row.id ? 'is-selected' : undefined}
                />
                <foreignObject x={x - 18} y={y - 18} width="36" height="36">
                  <button
                    type="button"
                    className="health-chart-hit"
                    aria-label={`${row.name} ${row.value} ${row.unit} on ${row.date}`}
                    onClick={() => onSelect({ kind: 'marker', id: row.id })}
                  />
                </foreignObject>
              </g>
            );
          })}
        </svg>
        <div className="health-table-scroll">
          <table>
            <caption>
              {sample ? 'Synthetic sample observations' : 'Reviewed observations'} · original
              reported units
            </caption>
            <thead>
              <tr>
                <th>Collected</th>
                <th>Marker</th>
                <th>Value</th>
                <th>Range</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((row) => {
                const record = sample
                  ? sampleBloodworkRecord
                  : records.find((item) => item.id === row.record_id);
                return (
                  <tr
                    key={row.id}
                    data-selected={selected?.id === row.id}
                    onClick={() => onSelect({ kind: 'marker', id: row.id })}
                  >
                    <td>{row.date}</td>
                    <td>{row.name}</td>
                    <td>
                      {row.value} {row.unit}
                      {row.flag ? ` · reported ${row.flag}` : ''}
                    </td>
                    <td>{row.range || 'Not supplied'}</td>
                    <td>
                      {record?.title || 'Original'}
                      <small>
                        {row.specimen || 'Unknown specimen'} · {row.method || 'Unknown method'} · v
                        {row.version}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {settings.comparisonDrawer && (
          <aside className="health-comparison" aria-label="Compatible comparisons">
            <p className="health-kicker">Comparable differences</p>
            {view.comparable.length ? (
              view.comparable.map((item) => (
                <p key={item.key}>
                  {item.name}: {item.difference! > 0 ? '+' : ''}
                  {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                    item.difference!,
                  )}{' '}
                  {item.latest.unit} since {item.previous!.date}. {item.limitation}
                </p>
              ))
            ) : (
              <p>No compatible dated pair is available. Units and methods stay separate.</p>
            )}
          </aside>
        )}
      </div>
      {selected?.kind === 'marker' && (
        <SourceInspect
          observation={source.find((row) => row.id === selected.id) ?? null}
          recordTitle={
            sample
              ? sampleBloodworkRecord.title
              : records.find(
                  (item) => item.id === source.find((row) => row.id === selected.id)?.record_id,
                )?.title
          }
        />
      )}
    </div>
  );
}

function SourceInspect({
  observation,
  recordTitle,
}: {
  observation: SavedObservation | null;
  recordTitle?: string;
}) {
  if (!observation) return null;
  return (
    <section className="health-source" aria-label="Source inspection">
      <p className="health-kicker">Source</p>
      <h3>{observation.name}</h3>
      <dl>
        <div>
          <dt>Reported value</dt>
          <dd>
            {observation.value} {observation.unit}
          </dd>
        </div>
        <div>
          <dt>Collection date</dt>
          <dd>{observation.date}</dd>
        </div>
        <div>
          <dt>Laboratory range</dt>
          <dd>{observation.range || 'Not supplied'}</dd>
        </div>
        <div>
          <dt>Specimen / method</dt>
          <dd>
            {observation.specimen || 'Unknown'} · {observation.method || 'Unknown'}
          </dd>
        </div>
        <div>
          <dt>Original</dt>
          <dd>{recordTitle || 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Comparison key</dt>
          <dd>{comparisonKey(observation)}</dd>
        </div>
      </dl>
    </section>
  );
}
