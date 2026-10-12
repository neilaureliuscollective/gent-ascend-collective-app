'use client';
import { useId } from 'react';
import { CoworkerReview } from './coworker-review';
import { ChartVisual } from './chart-visual';
import { scenarioValue } from '@/domains/artifacts/evidence';
import { EvidenceLinks } from './evidence-links';
import { visualPart, type VisualBoard as Board } from '@/domains/artifacts/visual';
/** Trusted renderer for data. Provider text never becomes HTML, script, URL or SVG markup. */
export function VisualBoard({
  board,
  partId,
  busy,
  onSelect,
  onExplain,
  scenarioPercent = 0,
  onScenario,
  onReturn,
}: {
  board: Board;
  partId?: string | null;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onExplain?: () => void;
  scenarioPercent?: number;
  onScenario?: (percent: number) => void;
  onReturn?: () => void;
}) {
  const heading = useId();
  const part = visualPart(board, partId);
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            board.kind === 'chart'
              ? {
                  board,
                  scenario: {
                    basis: 'hypothetical',
                    percent: scenarioPercent,
                    formula: 'reported value * (1 + percent / 100)',
                    values: board.points.map((point) => ({
                      id: point.id,
                      value: scenarioValue(point.value, scenarioPercent),
                    })),
                  },
                }
              : board,
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'aethelios-' + board.kind + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <article className="live-visual-board" aria-labelledby={heading}>
      <header>
        <span className="eyebrow">
          AETHELIOS /{' '}
          {board.kind === 'review'
            ? 'COWORKER REVIEW'
            : board.kind === 'diagram'
              ? 'SYSTEM MAP'
              : board.kind === 'chart'
                ? 'EVIDENCE / CHART'
                : 'COMPARISON'}
        </span>
        <h3 id={heading}>{board.title}</h3>
        <p>{board.summary}</p>
        <p className="live-visual-basis">
          {board.basis === 'coworker'
            ? 'Read-only Council suggestion · human review required.'
            : board.basis === 'research'
              ? 'Source-linked AI extraction · review original sources.'
              : 'Conceptual illustration · external facts and figures have not been verified.'}
        </p>
      </header>
      {board.kind === 'review' ? (
        <CoworkerReview board={board} onReturn={onReturn} busy={busy} />
      ) : board.kind === 'chart' ? (
        <ChartVisual
          board={board}
          partId={partId}
          busy={busy}
          percent={scenarioPercent}
          onSelect={onSelect}
          onScenario={onScenario}
        />
      ) : board.kind === 'diagram' ? (
        <>
          <div
            className="live-visual-map"
            tabIndex={0}
            aria-label="System map; select components below"
          >
            <svg
              viewBox={'0 0 750 ' + Math.ceil(board.nodes.length / 3) * 130}
              role="img"
              aria-label={board.title + ' connections'}
            >
              {board.edges.map((edge) => {
                const from = board.nodes.findIndex((node) => node.id === edge.from),
                  to = board.nodes.findIndex((node) => node.id === edge.to);
                const point = (index: number) => ({
                  x: 125 + (index % 3) * 250,
                  y: 55 + Math.floor(index / 3) * 130,
                });
                const a = point(from),
                  b = point(to);
                return <line key={edge.from + '/' + edge.to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
              })}
              {board.nodes.map((node, index) => (
                <g
                  key={node.id}
                  transform={
                    'translate(' +
                    (25 + (index % 3) * 250) +
                    ',' +
                    (20 + Math.floor(index / 3) * 130) +
                    ')'
                  }
                >
                  <rect
                    width="200"
                    height="70"
                    rx="14"
                    className={node.id === partId ? 'is-selected' : ''}
                  />
                  <text x="100" y="40" textAnchor="middle">
                    {node.label.slice(0, 23)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="live-visual-components" role="group" aria-label="Diagram components">
            {board.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                aria-pressed={node.id === partId}
                disabled={busy}
                onClick={() => onSelect(node.id)}
              >
                {node.label}
              </button>
            ))}
          </div>
          {board.edges.length > 0 && (
            <details>
              <summary>Connections</summary>
              <ul>
                {board.edges.map((edge) => (
                  <li key={edge.from + '/' + edge.to}>
                    {board.nodes.find((node) => node.id === edge.from)?.label} →{' '}
                    {board.nodes.find((node) => node.id === edge.to)?.label}: {edge.label}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="live-visual-table" tabIndex={0} aria-label="Scrollable comparison">
          <table>
            <caption>
              {board.title} ·{' '}
              {board.basis === 'research' ? 'source-linked comparison' : 'conceptual comparison'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Consideration</th>
                {board.options.map((option) => (
                  <th scope="col" key={option.id}>
                    <button
                      type="button"
                      aria-pressed={option.id === partId}
                      disabled={busy}
                      onClick={() => onSelect(option.id)}
                    >
                      {option.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{row.label}</th>
                  {board.options.map((option) => {
                    const cell = row.cells.find((item) => item.optionId === option.id)!;
                    return (
                      <td key={option.id} className={option.id === partId ? 'is-selected' : ''}>
                        <strong>{cell.value}</strong>
                        {board.kind === 'research-comparison' && (
                          <EvidenceLinks
                            evidence={
                              board.rows[index]!.cells.find((item) => item.optionId === option.id)!
                                .evidence
                            }
                            sources={board.sources}
                          />
                        )}
                        <details>
                          <summary>Rationale</summary>
                          <p>{cell.detail}</p>
                        </details>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {part && (
        <section
          className="live-visual-detail"
          aria-label="Selected visual detail"
          aria-live="polite"
        >
          <h4>{part.label}</h4>
          <p>{part.detail}</p>
          {onExplain && (
            <button type="button" disabled={busy} onClick={onExplain}>
              Explain selected part in voice
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => onSelect(null)}>
            Clear part selection
          </button>
        </section>
      )}
      {board.basis === 'research' && (
        <section className="live-research-sources" aria-label="Visual sources">
          <h4>Sources and limitations</h4>
          <p>
            Research retrieved {new Date(board.retrievedAt).toISOString().slice(0, 10)}. Source
            linkage is not independent fact verification.
          </p>
          <ul>
            {board.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  [{source.id}] {source.title}
                </a>
              </li>
            ))}
          </ul>
          <ul>
            {board.limitations.map((limit, index) => (
              <li key={index}>{limit}</li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={download}>
        Download visual data
      </button>
    </article>
  );
}
