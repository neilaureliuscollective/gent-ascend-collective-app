'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import { useWorldStill } from './cinematic-world';

gsap.registerPlugin(ScrollTrigger);

// One authored example carries the same decision through the six existing member destinations.
// It is presentation data, never a member record or a claim of automatic AI action.
const stages = [
  {
    question: 'Where am I?',
    label: 'Context',
    statement: 'The day is already full.',
    example: 'Work starts early. Training keeps moving to tomorrow.',
    insight: 'Start with an honest picture of today.',
    instrument: 'A clear starting point',
  },
  {
    question: 'What matters?',
    label: 'Direction',
    statement: 'Choose what deserves a place.',
    example: 'He decides to protect time for his health alongside his responsibilities.',
    insight: 'A priority is chosen, not assigned.',
    instrument: 'One chosen priority',
  },
  {
    question: 'What should I do?',
    label: 'Decision',
    statement: 'Make the next move concrete.',
    example: 'A short session before work is a step he can commit to.',
    insight: 'Aethelios can help him think it through. He confirms the action.',
    instrument: 'A deliberate next move',
  },
  {
    question: 'What did I do?',
    label: 'Action',
    statement: 'Record what actually happened.',
    example: 'In this illustrated day, he completes the session and records it.',
    insight: 'The record follows his action, not a prediction.',
    instrument: 'An action recorded',
  },
  {
    question: 'What did I learn?',
    label: 'Reflection',
    statement: 'Notice what made it possible.',
    example: 'The early hour held. Waiting until evening had not.',
    insight: 'Reflection gives the next decision context.',
    instrument: 'Something learned',
  },
  {
    question: 'What changes next?',
    label: 'Adaptation',
    statement: 'Carry the lesson forward.',
    example: 'He chooses the earlier window again for his next session.',
    insight: 'The system continues with him. He remains in command.',
    instrument: 'A better next cycle',
  },
] as const;

export function LifeSystem() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [directed, setDirected] = useState(false);
  const still = useWorldStill();

  useEffect(() => {
    const element = root.current;
    if (!element || still) return;
    setDirected(true);
    const update = (progress: number) =>
      setActive((previous) => {
        const next = Math.min(stages.length - 1, Math.floor(progress * stages.length));
        return previous === next ? previous : next;
      });
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress),
    });
    return () => {
      trigger?.kill();
      setDirected(false);
    };
  }, [still]);

  const chooseStage = (index: number) => {
    if (directed && root.current) {
      const length = root.current.offsetHeight - innerHeight;
      scrollTo({ top: root.current.offsetTop + length * ((index + 0.5) / stages.length), behavior: 'smooth' });
    }
    setActive(index);
  };

  const stage = stages[active] ?? stages[0]!;
  return (
    <section
      ref={root}
      id="the-system"
      className="life-system"
      data-chapter="system"
      data-active={active + 1}
      data-directed={directed}
      aria-labelledby="system-title"
    >
      <div className="life-system-stage">
        <div className="life-system-intro">
          <p className="estate-eyebrow">04 / THE GENT ASCEND LIFEOS</p>
          <h2 id="system-title">
            Direction becomes
            <br />
            <em>daily practice.</em>
          </h2>
          <p>One life. A loop that connects direction, action, evidence and what comes next.</p>
          <div className="life-system-story" key={active}>
            <span className="life-system-counter">
              0{active + 1} / 06 · {stage.label}
            </span>
            <span className="life-system-current-question">{stage.question}</span>
            <h3>{stage.statement}</h3>
            <p>{stage.example}</p>
            <small>{stage.insight}</small>
          </div>
          <p className="life-system-disclosure">An illustrative day · no personal data shown</p>
          <div className="estate-actions">
            <Link className="estate-primary" href="/gent-ascend">
              Explore the OS <span>↗</span>
            </Link>
            <Link href="/enter">Member entrance ↗</Link>
          </div>
        </div>
        <div className="life-system-instrument">
          <div className="life-system-orbits" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="life-system-center" aria-hidden="true">
            <span>AETHELIOS / CONTEXT</span>
            <strong>{stage.instrument}</strong>
            <span>THE ASCEND LOOP</span>
          </div>
          <ol className="life-system-stages" aria-label="Explore the six stages of the Ascend Loop">
            {stages.map((item, index) => (
              <li key={item.question}>
                <button
                  type="button"
                  aria-label={`0${index + 1} ${item.question}`}
                  aria-pressed={active === index}
                  onClick={() => chooseStage(index)}
                >
                  <span className="life-system-number">0{index + 1}</span>
                  <span className="life-system-question">{item.question}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="life-system-axis" aria-hidden="true">
            <span>WHERE I AM</span>
            <span>WHAT CHANGES</span>
          </div>
        </div>
        <div className="life-system-mobile-control">
          <span>Explore the loop · 0{active + 1} of 06</span>
          <button type="button" onClick={() => chooseStage((active + 1) % stages.length)}>
            {active === stages.length - 1 ? 'Begin again' : 'Next stage'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
