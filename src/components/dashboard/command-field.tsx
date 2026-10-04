'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { EnergyOrb } from '@/components/world/energy-orb';
import { useAppearance } from '@/components/visual/appearance';
import type { CommandProjection } from '@/domains/command/projection';
const paths = [
  'M500 215C350 215 310 95 180 95',
  'M500 215C650 215 700 95 820 95',
  'M500 215C340 215 310 335 180 335',
  'M500 215C650 215 700 335 820 335',
];
export function CommandField({
  projection,
  openPlan,
  status = 'ready',
  changed = false,
}: {
  projection: CommandProjection;
  openPlan: () => void;
  status?: 'ready' | 'refreshing' | 'stale';
  changed?: boolean;
}) {
  const { moving } = useAppearance();
  const [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const signal = projection.signals.find((item) => item.id === selected);
  return (
    <section className="command-field" aria-label="Your connected briefing">
      <div className="field-caption">
        <span>Your context, together</span>
        <span>
          {projection.signals.length ? 'Select a signal to see its source' : 'No saved signals yet'}
        </span>
      </div>
      <div className="field-space" data-signals={projection.signals.length} data-changed={changed}>
        <div className="field-horizon" aria-hidden="true" />
        <svg
          className="field-connections"
          viewBox="0 0 1000 430"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {projection.signals.map((item, i) => (
            <g key={item.id} data-selected={selected === item.id}>
              <path d={paths[i]} />
              <circle cx={i % 2 ? 820 : 180} cy={i < 2 ? 95 : 335} r="3" />
            </g>
          ))}
        </svg>
        <div className="field-core">
          <EnergyOrb moving={moving} framing={1.85} className="command-presence" />
          <div className="field-core-label">
            <strong>Aethelios</strong>
            <span>
              {status === 'refreshing'
                ? 'Refreshing saved context'
                : status === 'stale'
                  ? 'Last loaded context'
                  : projection.signals.length
                    ? 'Saved context prepared'
                    : 'No saved signals'}{' '}
              · no live analysis
            </span>
          </div>
        </div>
        {projection.signals.map((item, i) => (
          <button
            key={item.id}
            className={`field-signal signal-${i}`}
            data-kind={item.kind}
            aria-expanded={selected === item.id}
            aria-controls={selected === item.id ? 'command-signal-detail' : undefined}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setSelected(selected === item.id ? null : item.id);
            }}
          >
            <span className="signal-mark" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="signal-label">{item.label}</span>
            <strong key={item.value}>{item.value}</strong>
            {item.kind === 'actions' && (
              <span className="signal-completion" aria-hidden="true">
                {projection.day.actions.map((action) => (
                  <i key={action.id} data-done={action.done} />
                ))}
              </span>
            )}
            <span className="signal-source">{item.source}</span>
          </button>
        ))}
      </div>
      {signal && (
        <div id="command-signal-detail" className="signal-detail">
          <div>
            <span>{signal.source}</span>
            <h3>{signal.label}</h3>
            <p>{signal.detail}</p>
            <small>
              This connection brings a saved record into Command. It does not imply a causal
              relationship or a model assessment.
            </small>
          </div>
          <div>
            {signal.href ? (
              <Link prefetch={false} className="text-button" href={signal.href}>
                Open source ↗
              </Link>
            ) : (
              <button className="text-button" onClick={openPlan}>
                Open day workspace ↗
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setSelected(null);
                trigger.current?.focus();
              }}
            >
              Close detail
            </button>
          </div>
        </div>
      )}
      {projection.trajectory.some((point) => point.energy != null) && (
        <details className="command-trajectory">
          <summary>
            <span>Recorded rhythm</span>
            <span>7 days · self-reported energy</span>
          </summary>
          <div className="trajectory-strip">
            {projection.trajectory.map((point) => (
              <div key={point.day}>
                <span
                  className="trajectory-bar"
                  style={{ height: `${point.energy == null ? 3 : point.energy * 12}px` }}
                  data-gap={point.energy == null}
                />
                <strong>{point.energy ?? '—'}</strong>
                <time dateTime={point.day}>{point.day.slice(5)}</time>
              </div>
            ))}
          </div>
          <p>
            Missing days stay empty. Energy and sleep are observations you entered, not inferred
            performance.
          </p>
        </details>
      )}
    </section>
  );
}
