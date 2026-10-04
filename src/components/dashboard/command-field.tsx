'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { EnergyOrb } from '@/components/world/energy-orb';
import { useAppearance } from '@/components/visual/appearance';
import type { CommandProjection } from '@/domains/command/projection';
type Connection = { id: string; path: string; x: number; y: number };
type FieldGeometry = { width: number; height: number; connections: Connection[] };

export function CommandField({
  projection,
  openPlan,
  status = 'ready',
  changed = false,
  confirmedRevision = 0,
}: {
  projection: CommandProjection;
  openPlan: () => void;
  status?: 'ready' | 'refreshing' | 'stale';
  changed?: boolean;
  confirmedRevision?: number;
}) {
  const { moving } = useAppearance();
  const field = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const graph = useRef<SVGSVGElement>(null);
  const anchors = useRef(new Map<string, HTMLButtonElement>());
  const gradient = `command-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [geometry, setGeometry] = useState<FieldGeometry | null>(null);
  const signalIds = projection.signals.map((item) => item.id).join('|');
  const fingerprint = JSON.stringify(
    projection.signals.map(({ id, value, source, detail }) => ({ id, value, source, detail })),
  );
  const previous = useRef<{
    fingerprint: string;
    revision: number;
    values: Map<string, string>;
  } | null>(null);

  // Measure only after layout changes. No continuous layout reads or animation state in React.
  useEffect(() => {
    const host = field.current;
    const presence = core.current;
    if (!host || !presence) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const box = host.getBoundingClientRect();
      const orb = presence.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const center = {
        x: orb.left + orb.width / 2 - box.left,
        y: orb.top + orb.height / 2 - box.top,
      };
      // Shared renderer radius .73 / framing 1.85; fallback uses matching framing.
      const radius = (Math.min(orb.width, orb.height) * 0.73) / 1.85;
      const connections: Connection[] = [];
      for (const [id, anchor] of anchors.current) {
        const target = anchor.getBoundingClientRect();
        const left = target.left + target.width / 2 < orb.left + orb.width / 2;
        const x = (left ? target.right : target.left) - box.left;
        const y = target.top + target.height / 2 - box.top;
        const dx = x - center.x,
          dy = y - center.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius + 8) continue;
        const startX = center.x + (dx / distance) * radius;
        const startY = center.y + (dy / distance) * radius;
        const bend = Math.min(100, Math.abs(x - startX) * 0.55);
        const direction = left ? -1 : 1;
        const round = (v: number) => Math.round(v * 10) / 10;
        connections.push({
          id,
          x: round(x),
          y: round(y),
          path: `M${round(startX)} ${round(startY)} C${round(startX + direction * bend)} ${round(startY)} ${round(x - direction * bend)} ${round(y)} ${round(x)} ${round(y)}`,
        });
      }
      const next = { width: box.width, height: box.height, connections };
      setGeometry((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    resize.observe(presence);
    for (const anchor of anchors.current.values()) resize.observe(anchor);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [signalIds]);

  // One finite trace per changed saved snapshot, never activity invented by an idle loop.
  useEffect(() => {
    if (status !== 'ready') return;
    const values = new Map<string, string>(
      JSON.parse(fingerprint).map((item: { id: string }) => [item.id, JSON.stringify(item)]),
    );
    const last = previous.current;
    previous.current = { fingerprint, revision: confirmedRevision, values };
    if (!last || !moving || document.hidden || document.documentElement.dataset.quiet === 'true')
      return;
    const inward = confirmedRevision > last.revision;
    const animations: Animation[] = [];
    for (const path of graph.current?.querySelectorAll<SVGPathElement>('.connection-trace') ?? []) {
      const id = path.dataset.signal;
      if (!id || values.get(id) === last.values.get(id)) continue;
      path.dataset.flow = inward ? 'confirmed' : 'updated';
      animations.push(
        path.animate(
          [
            { strokeDashoffset: inward ? -1 : 1, opacity: 0 },
            { opacity: 0.95, offset: 0.2 },
            { strokeDashoffset: 0, opacity: 0 },
          ],
          { duration: 1150, easing: 'ease-in-out' },
        ),
      );
    }
    if (!animations.length) return;
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const quiet = () => {
      if (document.hidden || document.documentElement.dataset.quiet === 'true') cancel();
    };
    const observer = new MutationObserver(quiet);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-quiet'],
    });
    const visibility = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) cancel();
    });
    if (field.current) visibility.observe(field.current);
    document.addEventListener('visibilitychange', quiet);
    const cleanup = () => {
      cancel();
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', quiet);
    };
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
    return cleanup;
  }, [fingerprint, confirmedRevision, moving, status]);
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
      <div
        ref={field}
        className="field-space"
        data-signals={projection.signals.length}
        data-changed={changed}
        data-state={status}
      >
        <div className="field-horizon" aria-hidden="true" />
        <svg
          ref={graph}
          className="field-connections"
          viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : undefined}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2=".7">
              <stop stopColor="#72bf98" stopOpacity=".3" />
              <stop offset=".48" stopColor="#b5d6a9" />
              <stop offset="1" stopColor="#d7b778" stopOpacity=".8" />
            </linearGradient>
          </defs>
          {geometry?.connections.map((connection) => (
            <g
              key={connection.id}
              data-signal={connection.id}
              data-selected={selected === connection.id}
            >
              <path className="connection-halo" d={connection.path} />
              <path
                className="connection-filament"
                d={connection.path}
                stroke={`url(#${gradient})`}
              />
              <path
                className="connection-trace"
                data-signal={connection.id}
                d={connection.path}
                pathLength="1"
              />
              <circle
                className="connection-anchor-halo"
                cx={connection.x}
                cy={connection.y}
                r="7"
              />
              <circle className="connection-anchor" cx={connection.x} cy={connection.y} r="2.5" />
            </g>
          ))}
        </svg>
        <div className="field-core">
          <div ref={core} className="field-presence-anchor">
            <EnergyOrb moving={moving} framing={1.85} className="command-presence" />
          </div>
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
            ref={(element) => {
              if (element) anchors.current.set(item.id, element);
              else anchors.current.delete(item.id);
            }}
            data-signal-id={item.id}
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
