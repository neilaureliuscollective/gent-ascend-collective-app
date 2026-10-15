'use client';
import {
  bloodworkWorkspace,
  formatMeasuredNumber,
  formatReportedValue,
  toggleMarker,
} from '@/domains/health/bloodwork';
import {
  sampleBloodwork,
  sampleBloodworkRecord,
  sampleWorkspaceNotice,
} from '@/domains/health/sample';
import type { HealthRecord, SavedObservation } from '@/domains/health/schema';
import { numeric } from '@/domains/health/trends';
import type { BloodworkSettings, SelectedElement } from '@/domains/health/workspace-model';

export type BloodworkPart = 'hero' | 'trend' | 'table' | 'source';

export function BloodworkTool({
  observations,
  records,
  settings,
  sample,
  selected,
  blocked,
  onSettings,
  onSelect,
  parts = ['hero', 'trend', 'table', 'source'],
}: {
  observations: SavedObservation[];
  records: HealthRecord[];
  settings: BloodworkSettings;
  sample: boolean;
  selected: SelectedElement | null;
  blocked: boolean;
  onSettings: (next: BloodworkSettings) => void;
  onSelect: (next: SelectedElement) => void;
  parts?: BloodworkPart[];
}) {
  const source = sample ? sampleBloodwork : observations;
  const view = bloodworkWorkspace(source, settings, sample);
  const chart = view.chartRows.map((row) => ({
    row,
    value: numeric(row.value)!,
    at: Date.parse(`${row.date}T12:00:00Z`),
  }));
  const first = chart.length ? Math.min(...chart.map((item) => item.at)) : 0;
  const last = chart.length ? Math.max(...chart.map((item) => item.at)) : 1;
  const min = chart.length ? Math.min(...chart.map((item) => item.value)) : 0;
  const max = chart.length ? Math.max(...chart.map((item) => item.value)) : 1;
  const latest = view.focus?.latest ?? null;
  const show = (part: BloodworkPart) => parts.includes(part);
  return (
    <div
      className="health-tool"
      data-tool="bloodwork-tracker"
      data-sample={sample}
      data-density={settings.density}
    >
      {show('hero') && (
      <section className="health-next" aria-label="Selected bloodwork trend">
        <p className="health-kicker">{sample ? 'Sample evidence' : 'Reviewed evidence'}</p>
        {view.emptySelection ? (
          <>
            <h2>Select a marker</h2>
            <p>Nothing is shown until a marker is chosen. Deselecting all markers stays empty.</p>
          </>
        ) : (
          <>
            <h2>{view.focus?.name ?? 'Bloodwork Tracker'}</h2>
            <p>
              {sample
                ? sampleWorkspaceNotice
                : 'Original units, collection dates and laboratory ranges.'}
              {latest
                ? ` Latest ${formatReportedValue(latest.value)} ${latest.unit} on ${latest.date}.`
                : ''}
            </p>
          </>
        )}
      </section>
      )}
      {show('trend') && (
      <div className="health-toolbar health-toolbar-compact">
        <fieldset disabled={blocked}>
          <legend>Markers</legend>
          {view.markers.map((marker) => (
            <label key={marker.key} className="health-chip">
              <input
                type="checkbox"
                checked={settings.markerKeys.includes(marker.key)}
                onChange={() => onSettings(toggleMarker(settings, marker.key))}
              />
              {marker.name}
            </label>
          ))}
        </fieldset>
        <label className="health-chip">
          <input
            type="checkbox"
            checked={settings.density === 'compact'}
            disabled={blocked}
            onChange={(e) =>
              onSettings({ ...settings, density: e.target.checked ? 'compact' : 'comfortable' })
            }
          />
          Compact density
        </label>
        {settings.dateRange && (
          <fieldset disabled={blocked} className="health-dates">
            <legend>Dates</legend>
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
      </div>
      )}
      {(show('trend') || show('table')) &&
        (view.emptySelection ? (
        <p className="health-empty-selection">Choose one marker to open its trend and source.</p>
      ) : (
        <div className="health-evidence-layout" data-arrangement={settings.arrangement}>
          {show('trend') && chart.length ? (
            <svg
              className="health-chart"
              viewBox="0 0 560 220"
              role="img"
              aria-label={`${view.focus?.name ?? 'Marker'} in ${view.focus?.latest.unit ?? ''} over collection dates`}
            >
              <text x="16" y="28" className="health-chart-label">
                {view.focus?.latest.unit}
              </text>
              <text x="16" y="48" className="health-chart-label">
                {formatMeasuredNumber(max)}
              </text>
              <text x="16" y="188" className="health-chart-label">
                {formatMeasuredNumber(min)}
              </text>
              {chart.length > 1 && (
                <polyline
                  className="health-chart-line"
                  fill="none"
                  points={chart
                    .map((item) => {
                      const x =
                        72 + (last === first ? 0.5 : (item.at - first) / (last - first)) * 460;
                      const y = 40 + (max === min ? 70 : ((max - item.value) / (max - min)) * 130);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}
              {chart.map((item) => {
                const x = 72 + (last === first ? 0.5 : (item.at - first) / (last - first)) * 460;
                const y = 40 + (max === min ? 70 : ((max - item.value) / (max - min)) * 130);
                return (
                  <g key={item.row.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={selected?.id === item.row.id ? 6 : 4}
                      className={selected?.id === item.row.id ? 'is-selected' : undefined}
                    />
                    <text x={x} y="208" textAnchor="middle" className="health-chart-label">
                      {item.row.date.slice(5)}
                    </text>
                    <foreignObject x={x - 18} y={y - 18} width="36" height="36">
                      <button
                        type="button"
                        className="health-chart-hit"
                        aria-label={`${item.row.name} ${formatReportedValue(item.row.value)} ${item.row.unit} on ${item.row.date}`}
                        onClick={() => onSelect({ kind: 'marker', id: item.row.id })}
                      />
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          ) : show('trend') ? (
            <p className="health-empty-selection">
              {view.qualitative.length
                ? 'This marker has reported results without a numeric scale, so they are listed rather than plotted.'
                : 'No dated numeric results are in this window.'}
            </p>
          ) : null}
          {show('table') && (
          <div className="health-table-scroll">
            <table>
              <caption>
                {sample ? 'Synthetic sample observations' : 'Reviewed observations'} · original
                reported units · {view.focus?.name}
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
                        {formatReportedValue(row.value)} {row.unit}
                        {row.flag ? ` · reported ${row.flag}` : ''}
                        {numeric(row.value) === null ? ' · qualitative' : ''}
                      </td>
                      <td>{row.range || 'Not supplied'}</td>
                      <td>
                        {record?.title || 'Original'}
                        <small>
                          {row.specimen || 'Unknown specimen'} · {row.method || 'Unknown method'} ·
                          v{row.version}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          {show('table') && settings.comparisonDrawer && (
            <aside className="health-comparison" aria-label="Compatible comparisons">
              <p className="health-kicker">Comparable difference</p>
              {view.comparable.length ? (
                view.comparable.map((item) => (
                  <p key={item.key}>
                    {item.name}: {item.difference! > 0 ? '+' : ''}
                    {formatMeasuredNumber(item.difference!)} {item.latest.unit} since{' '}
                    {item.previous!.date}. {item.limitation}
                  </p>
                ))
              ) : (
                <p>No compatible dated pair is available. Units and methods stay separate.</p>
              )}
            </aside>
          )}
        </div>
      ))}
      {show('source') && selected?.kind === 'marker' && (
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
            {formatReportedValue(observation.value)} {observation.unit}
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
          <dt>Comparable with</dt>
          <dd>The same reported name or code, unit, specimen and method.</dd>
        </div>
      </dl>
    </section>
  );
}
