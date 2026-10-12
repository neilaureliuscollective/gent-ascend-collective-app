import React, { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { createRoot } from 'react-dom/client';
import {
  intelligencePhases,
  intelligenceStatus,
  measuredAudioLevel,
  type IntelligenceOperation,
  type IntelligencePhase,
} from '../../src/platform/visual/intelligence-motion';
import './identity-studies.css';

type Study = 'aperture' | 'contours' | 'core';
const studies: { id: Study; title: string; description: string }[] = [
  {
    id: 'aperture',
    title: '01 · Guiding aperture',
    description:
      'The emerald sphere gathers light inside a precise guiding aperture. Recommended primary identity.',
  },
  {
    id: 'contours',
    title: '02 · Aligned contours',
    description:
      'The sphere’s internal contours follow the architectural axis and diagonals of the official A.',
  },
  {
    id: 'core',
    title: '03 · Concentrated core',
    description:
      'A quieter circular boundary and four-point focus, designed to remain clear at compact sizes.',
  },
];
function effectivePhase(operation: IntelligenceOperation): IntelligencePhase {
  if (operation.persistence === 'uncertain')
    return operation.phase === 'cancelled' ? 'cancelled' : 'failed';
  if (operation.phase === 'complete' && operation.persistence === 'pending') return 'saving';
  if (operation.label) return 'ready';
  return operation.phase;
}
function Presence({
  study,
  operation,
  still,
  compact = false,
}: {
  study: Study;
  operation: IntelligenceOperation;
  still: boolean;
  compact?: boolean;
}) {
  const uid = useId().replaceAll(':', '');
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries[0]?.isIntersecting ?? false),
    );
    if (ref.current) observer.observe(ref.current);
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const phase = effectivePhase(operation);
  const level = measuredAudioLevel(operation);
  return (
    <div
      ref={ref}
      data-paused={!visible || hidden}
      className={`identity-presence identity-${study} ${compact ? 'identity-compact' : ''}`}
      data-phase={phase}
      data-still={still}
      style={{ '--level': level } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 240" focusable="false">
        <defs>
          <radialGradient id={`${uid}-body`} cx="32%" cy="25%" r="76%">
            <stop stopColor="#36896C" />
            <stop offset=".3" stopColor="#236A52" />
            <stop offset=".7" stopColor="#102B26" />
            <stop offset="1" stopColor="#080D0D" />
          </radialGradient>
          <radialGradient id={`${uid}-light`}>
            <stop stopColor="#7BE7B1" stopOpacity=".85" />
            <stop offset=".35" stopColor="#36896C" stopOpacity=".45" />
            <stop offset="1" stopColor="#174438" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <circle cx="120" cy="120" r="82" />
          </clipPath>
        </defs>
        <circle
          className="identity-boundary"
          cx="120"
          cy="120"
          r="92"
          fill="none"
          stroke="#C4912F"
          strokeWidth=".6"
        />
        <circle
          className="identity-body"
          cx="120"
          cy="120"
          r="82"
          fill={`url(#${uid}-body)`}
          stroke="#36896C"
          strokeWidth=".7"
        />
        <g clipPath={`url(#${uid}-clip)`}>
          <circle className="identity-light" cx="108" cy="104" r="76" fill={`url(#${uid}-light)`} />
          <g className="identity-flow" fill="none" stroke="#7BE7B1" strokeWidth=".8">
            {study === 'contours' ? (
              <>
                <path d="M64 175 120 55 176 175 M88 133h64" />
                <path d="M78 177 120 86 162 177 M97 146h46" />
                <path d="M120 40v160" />
              </>
            ) : study === 'aperture' ? (
              <>
                <ellipse cx="120" cy="120" rx="63" ry="40" transform="rotate(-32 120 120)" />
                <ellipse cx="120" cy="120" rx="49" ry="29" transform="rotate(-32 120 120)" />
                <path d="M80 153 Q120 115 161 86" />
              </>
            ) : (
              <>
                <circle cx="120" cy="120" r="46" />
                <path d="M120 67v106 M67 120h106" />
              </>
            )}
          </g>
          <g className="identity-focus">
            <path
              d="M120 102Q123 117 138 120Q123 123 120 138Q117 123 102 120Q117 117 120 102Z"
              fill="#E0BB6A"
            />
            <circle cx="120" cy="120" r="2" fill="#E6E7E2" />
          </g>
        </g>
        <path
          className="identity-aperture"
          d="M60 69 A79 79 0 0 1 180 69 M60 171 A79 79 0 0 0 180 171"
          fill="none"
          stroke="#E0BB6A"
          strokeWidth="1.1"
        />
        <circle
          className="identity-envelope"
          cx="120"
          cy="120"
          r="87"
          fill="none"
          stroke="#7BE7B1"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
function App() {
  const [study, setStudy] = useState<Study>('aperture');
  const [phase, setPhase] = useState<IntelligencePhase>('waiting');
  const [surface, setSurface] = useState('Talk');
  const [still, setStill] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [level, setLevel] = useState(0);
  const [persistence, setPersistence] =
    useState<IntelligenceOperation['persistence']>('not-applicable');
  const [label, setLabel] = useState<IntelligenceOperation['label']>();
  const [playing, setPlaying] = useState(false);
  const [long, setLong] = useState(false);
  const [mono, setMono] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const sequence: IntelligencePhase[] = [
      'waiting',
      'thinking',
      'generating',
      'saving',
      'complete',
    ];
    let index = 0;
    const timer = setInterval(() => {
      index++;
      const next = sequence[index];
      if (!next) {
        setPlaying(false);
        return;
      }
      setPhase(next);
      setPersistence(
        next === 'saving' ? 'pending' : next === 'complete' ? 'confirmed' : 'not-applicable',
      );
    }, 1800);
    return () => clearInterval(timer);
  }, [playing]);
  const operation: IntelligenceOperation = {
    id: 'identity-study',
    basis: 'preview',
    phase,
    audioLevel: level,
    persistence,
    label,
  };
  const quiet = still || reduced;
  const status = intelligenceStatus(operation);
  return (
    <main data-monochrome={mono}>
      <header>
        <Image
          src="/brand/aethelios-aether-20261007.webp"
          width="64"
          height="64"
          alt="Official Aethelios crest"
        />
        <div>
          <p className="eyebrow">AETHELIOS · IDENTITY STUDIES</p>
          <h1>Intelligence, given form.</h1>
        </div>
      </header>
      <p className="disclosure">
        Visual studies only. All activity and voice levels are simulated. No model, microphone,
        saving or live operation is running.
      </p>
      <section className="study-options" aria-label="Identity concepts">
        {studies.map((item) => (
          <button
            className={study === item.id ? 'selected' : ''}
            key={item.id}
            onClick={() => setStudy(item.id)}
            aria-pressed={study === item.id}
          >
            <Presence
              study={item.id}
              operation={{ id: item.id, phase: 'ready', basis: 'preview' }}
              still
              compact
            />
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </section>
      <section className="controls" aria-label="Study controls">
        <label>
          <input
            type="checkbox"
            checked={mono}
            onChange={(event) => setMono(event.target.checked)}
          />{' '}
          Monochrome construction
        </label>
        <label>
          Preview layout
          <select value={surface} onChange={(event) => setSurface(event.target.value)}>
            {['Talk', 'Live', 'Work', 'Studio'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Operation pose
          <select
            value={phase}
            onChange={(event) => {
              setPlaying(false);
              setPhase(event.target.value as IntelligencePhase);
            }}
          >
            {intelligencePhases.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Save receipt
          <select
            value={persistence}
            onChange={(event) =>
              setPersistence(event.target.value as IntelligenceOperation['persistence'])
            }
          >
            {['not-applicable', 'pending', 'confirmed', 'uncertain'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Modifier
          <select
            value={label ?? ''}
            onChange={(event) =>
              setLabel((event.target.value || undefined) as IntelligenceOperation['label'])
            }
          >
            <option value="">None</option>
            {[
              'Microphone muted',
              'Voice playback blocked',
              'Session ended',
              'Connection unavailable',
              'Waiting for approval',
              'Task declined',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Illustrative voice envelope: {level.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step=".01"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={still}
            onChange={(event) => setStill(event.target.checked)}
          />{' '}
          Still
        </label>
        <label>
          <input
            type="checkbox"
            checked={long}
            onChange={(event) => setLong(event.target.checked)}
          />{' '}
          Long reply / brief
        </label>
        <button
          onClick={() => {
            if (!playing) {
              setPhase('waiting');
              setPersistence('not-applicable');
              setLabel(undefined);
            }
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'Stop scripted preview' : 'Play scripted preview'}
        </button>
      </section>
      <section
        className={`preview preview-${surface.toLowerCase()}`}
        aria-label={`${surface} layout study`}
      >
        <div className="preview-heading">
          <span>{surface} · Layout study</span>
          <span>Synthetic preview</span>
        </div>
        {surface !== 'Live' && (
          <p className="user-message">
            {surface === 'Studio'
              ? 'Develop an elegant campaign direction.'
              : surface === 'Work'
                ? 'Help me shape the next move.'
                : 'Let’s think this through together.'}
          </p>
        )}
        <div className="active-answer">
          <div className="presence-anchor">
            <Presence
              key={study}
              study={study}
              operation={operation}
              still={quiet}
              compact={surface === 'Work' || surface === 'Studio'}
            />
            <div>
              <span className="eyebrow">AETHELIOS</span>
              <p role="status">{status} · Preview</p>
            </div>
          </div>
          {surface === 'Live' ? (
            <p className="voice-note">
              Voice presentation study. Move the illustrative envelope slider while listening or
              speaking. Zero means no measured sound.
            </p>
          ) : (
            <div className="answer-copy">
              <h2>
                {phase === 'generating' || phase === 'complete'
                  ? 'A direction begins to take shape.'
                  : 'The active response lives here.'}
              </h2>
              <p>
                The emerald form belongs beside the answer you are waiting for. Its guiding light
                gathers, directs and resolves while the words remain easy to read.
              </p>
              {long &&
                Array.from({ length: 16 }, (_, index) => (
                  <p key={index}>
                    Sample paragraph {index + 1}. This long synthetic response lets you check
                    whether the intelligence stays visible while scrolling, without covering the
                    work or interrupting reading.
                  </p>
                ))}
            </div>
          )}
        </div>
        <div className="composer">
          <span>
            {surface === 'Live'
              ? 'Microphone inactive · Visual study'
              : surface === 'Studio'
                ? 'Campaign brief · Preview only'
                : 'Message Aethelios… · Preview only'}
          </span>
        </div>
      </section>
      <section className="construction">
        <h2>Brand construction</h2>
        <p>
          The official seal remains untouched. These studies borrow its circular boundary,
          architectural alignment and four-point focus. Emerald carries activity; Reserve Gold marks
          guidance and a confirmed resolution.
        </p>
        <p>
          SVG and CSS only in this comparison build. No GPU context, video, particle engine or new
          runtime dependency. A focal shader remains an option after the visual direction is
          selected.
        </p>
      </section>
      <section className="pose-board" aria-label="All operation poses">
        {intelligencePhases.map((value) => (
          <article key={value}>
            <Presence
              study={study}
              operation={{
                id: value,
                phase: value,
                basis: 'preview',
                persistence: value === 'complete' ? 'confirmed' : 'not-applicable',
              }}
              still
            />
            <span>{value} · Still pose</span>
          </article>
        ))}
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
