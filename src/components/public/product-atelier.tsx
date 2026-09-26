'use client';
import Link from 'next/link';
import { OrbitSignature } from '@/components/visual/orbit-signature';
import { useEffect, useRef, useState } from 'react';
import { useWorldStill } from './cinematic-world';
import type { createProductStage } from './product-stage';
const details = [
  {
    label: 'The form',
    title: 'Considered from every angle.',
    copy: 'An early study of the Vitalis silhouette: a dark vessel, measured gold details, and a pump designed around the daily ritual.',
  },
  {
    label: 'The ritual',
    title: 'A moment to prepare.',
    copy: 'Hair and beard care belongs to the beginning of the day. Vitalis is being developed around that simple, deliberate act.',
  },
  {
    label: 'The intention',
    title: 'The house standard.',
    copy: 'Our signature oil is taking shape. Final formula, packaging, directions and availability will be published with the finished product.',
  },
];
export function ProductAtelier() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<ReturnType<typeof createProductStage> | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [angle, setAngle] = useState(0);
  const [warm, setWarm] = useState(true);
  const [detail, setDetail] = useState(0);
  const still = useWorldStill();
  const drag = useRef<{ x: number; angle: number } | null>(null);
  useEffect(() => {
    if (!enabled || !host.current) return;
    const node = host.current;
    let disposed = false;
    import('./product-stage')
      .then(({ createProductStage }) => {
        if (disposed) return;
        try {
          stage.current = createProductStage(node, () => setStatus('fallback'));
          setStatus('ready');
        } catch {
          setStatus('fallback');
        }
      })
      .catch(() => {
        if (!disposed) setStatus('fallback');
      });
    return () => {
      disposed = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [enabled]);
  useEffect(() => {
    stage.current?.rotate(angle);
  }, [angle, status]);
  useEffect(() => {
    stage.current?.light(warm);
  }, [warm, status]);
  useEffect(() => {
    if (status === 'fallback') {
      stage.current?.dispose();
      stage.current = null;
    }
  }, [status]);
  const info = details[detail]!;
  return (
    <div className="product-atelier" data-renderer={status}>
      <div className="atelier-visual">
        <span className="atelier-coordinate">
          LR / 001 <span>OBJECT STUDY</span>
        </span>
        <div className="atelier-orbit" aria-hidden="true" />
        <div
          className="atelier-model"
          onPointerDown={(e) => {
            if (status !== 'ready') return;
            drag.current = { x: e.clientX, angle };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current)
              setAngle(
                Math.round(
                  (((drag.current.angle + (e.clientX - drag.current.x) * 0.7) % 360) + 360) % 360,
                ),
              );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <div
            className="atelier-static"
            aria-hidden="true"
            style={{ transform: `rotateY(${angle}deg)` }}
          >
            <div className="atelier-pump" />
            <div className="atelier-bottle">
              <span>LEGACY RESERVE</span>
              <strong>Vitalis</strong>
              <small>HAIR & BEARD OIL</small>
            </div>
          </div>
          <div ref={host} className="atelier-canvas" />
        </div>
        <div className="atelier-controls">
          {status === 'idle' && (
            <button
              className="world-button"
              onClick={() => {
                setStatus('loading');
                setEnabled(true);
              }}
            >
              Explore in 3D <span>↗</span>
            </button>
          )}
          <p role="status">
            {status === 'loading'
              ? 'Opening the study…'
              : status === 'fallback'
                ? 'Still study shown. 3D is unavailable on this device.'
                : status === 'ready'
                  ? 'Drag the vessel, or use the rotation control.'
                  : 'A closer look at the form.'}
          </p>
          {status === 'ready' && (
            <>
              <label>
                Rotate vessel
                <input
                  aria-label="Rotate vessel"
                  type="range"
                  min="0"
                  max="360"
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                />
              </label>
              <div className="atelier-light">
                <button aria-pressed={warm} onClick={() => setWarm(true)}>
                  Warm gold
                </button>
                <button aria-pressed={!warm} onClick={() => setWarm(false)}>
                  Emerald light
                </button>
                <button
                  onClick={() => {
                    setAngle(0);
                    setWarm(true);
                  }}
                >
                  Reset view
                </button>
              </div>
            </>
          )}
        </div>
        <small className="atelier-disclosure">Concept packaging · final product may differ</small>
      </div>
      <div className="atelier-story">
        <OrbitSignature />
        <span className="world-kicker">Legacy Reserve / Vitalis</span>
        <h2>
          The ritual.
          <br />
          <em>In your hands.</em>
        </h2>
        <div className="atelier-select" role="group" aria-label="Explore Vitalis">
          {details.map((item, i) => (
            <button
              key={item.label}
              aria-pressed={detail === i}
              onClick={() => {
                setDetail(i);
                if (!still) setAngle(i === 0 ? 0 : i === 1 ? 45 : 315);
              }}
            >
              <small>0{i + 1}</small>
              {item.label}
            </button>
          ))}
        </div>
        <div className="atelier-detail" aria-live="polite">
          <h3>{info.title}</h3>
          <p>{info.copy}</p>
        </div>
        <Link href="/shop/vitalis" className="world-text-link">
          Discover Vitalis ↗
        </Link>
        <p className="atelier-footnote">In development. Not available to order.</p>
      </div>
    </div>
  );
}
