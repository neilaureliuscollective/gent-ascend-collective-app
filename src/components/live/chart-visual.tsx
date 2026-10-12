'use client';
import { useId } from 'react';
import type { VisualBoard } from '@/domains/artifacts/visual';
import { chartRange, scenarioValue } from '@/domains/artifacts/evidence';
import { EvidenceLinks } from './evidence-links';
type Chart = Extract<VisualBoard, { kind: 'chart' }>;
const number = (value: number | null) => (value === null ? 'Not available' : String(value));
export function ChartVisual({
  board,
  partId,
  percent,
  busy,
  onSelect,
  onScenario,
}: {
  board: Chart;
  partId?: string | null;
  percent: number;
  busy: boolean;
  onSelect: (id: string) => void;
  onScenario?: (percent: number) => void;
}) {
  const description = useId();
  const { min, max } = chartRange(board, percent),
    span = max - min || 1;
  const x = (value: number) => 220 + ((value - min) / span) * 470;
  const zero = x(0),
    height = board.points.length * 80 + 50;
  return (
    <>
      {onScenario && (
        <form
          className="live-chart-scenario"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const value = Number(form.get('percent'));
            if (Number.isInteger(value) && value >= -50 && value <= 50) onScenario(value);
          }}
        >
          <label>
            Hypothetical change (%){' '}
            <input
              key={percent}
              name="percent"
              type="number"
              min={-50}
              max={50}
              step={1}
              required
              defaultValue={percent}
              disabled={busy}
            />
          </label>
          <button disabled={busy}>Apply hypothetical change</button>
          <p>
            Reported value × (1 + change ÷ 100). Applies uniformly; this is an assumption, not a
            forecast. Original evidence stays unchanged.
          </p>
        </form>
      )}
      <figure role="group" className="live-chart" aria-labelledby={description}>
        <div className="live-visual-map" tabIndex={0} aria-label="Scrollable chart">
          <svg
            viewBox={'0 0 760 ' + height}
            role="img"
            aria-label={board.measure + ' in ' + board.unit + ' for ' + board.period}
            aria-describedby={description}
          >
            <line x1={zero} x2={zero} y1={10} y2={height - 30} />
            {board.points.map((point, index) => {
              const y = index * 80 + 20;
              const value = point.value;
              const hypothetical = scenarioValue(value, percent);
              return (
                <g key={point.id}>
                  <text x="10" y={y + 18}>
                    {point.label.slice(0, 23)}
                  </text>
                  {value === null ? (
                    <text x="225" y={y + 18}>
                      Not available
                    </text>
                  ) : (
                    <>
                      {value === 0 ? (
                        <circle cx={zero} cy={y + 10} r="4" />
                      ) : (
                        <rect
                          className="live-chart-reported"
                          x={Math.min(zero, x(value))}
                          y={y}
                          width={Math.abs(x(value) - zero)}
                          height="20"
                          rx="3"
                        />
                      )}
                      {percent !== 0 && hypothetical !== null && (
                        <rect
                          className="live-chart-hypothetical"
                          x={Math.min(zero, x(hypothetical))}
                          y={y + 30}
                          width={Math.abs(x(hypothetical) - zero)}
                          height="18"
                          rx="3"
                        />
                      )}
                    </>
                  )}
                </g>
              );
            })}
            <text x="220" y={height - 8}>
              {number(min)}
            </text>
            <text x="690" y={height - 8} textAnchor="end">
              {number(max)}
            </text>
          </svg>
        </div>
        <figcaption id={description}>
          {board.measure} · {board.unit} · {board.period}. Filled bars: source-linked values.{' '}
          {percent !== 0 ? 'Dashed bars: hypothetical ' + percent + '% change. ' : ''}The table
          below contains values, missing data and source links.
        </figcaption>
      </figure>
      <div className="live-visual-table" tabIndex={0} aria-label="Chart data table">
        <table>
          <caption>
            {board.title} · {board.period} · {board.unit}
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Source-linked value</th>
              {percent !== 0 && <th scope="col">Hypothetical {percent}%</th>}
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {board.points.map((point) => (
              <tr key={point.id} className={point.id === partId ? 'is-selected' : ''}>
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={point.id === partId}
                    disabled={busy}
                    onClick={() => onSelect(point.id)}
                  >
                    {point.label}
                  </button>
                </th>
                <td>{number(point.value)}</td>
                {percent !== 0 && <td>{number(scenarioValue(point.value, percent))}</td>}
                <td>
                  <EvidenceLinks evidence={point.evidence} sources={board.sources} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
