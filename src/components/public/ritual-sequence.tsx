'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useWorldStill } from './cinematic-world';

gsap.registerPlugin(ScrollTrigger);

/** Two compositions in one held scene; Still keeps both in document flow. */
export function RitualSequence() {
  const root = useRef<HTMLElement>(null);
  const [directed, setDirected] = useState(false);
  const [active, setActive] = useState<1 | 2>(1);
  const still = useWorldStill();

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia('(prefers-reduced-motion: no-preference)');
    let trigger: ScrollTrigger | undefined;
    let refreshFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    observer.observe(element);
    const sync = () => {
      trigger?.kill();
      trigger = undefined;
      const shouldDirect = media.matches && !still;
      setDirected(shouldDirect);
      if (!shouldDirect) {
        setActive(1);
        return;
      }
      trigger = ScrollTrigger.create({
        trigger: element,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => setActive(progress < 0.52 ? 1 : 2),
        onRefresh: ({ progress }) => setActive(progress < 0.52 ? 1 : 2),
      });
    };
    sync();
    media.addEventListener('change', sync);
    return () => {
      media.removeEventListener('change', sync);
      observer.disconnect();
      cancelAnimationFrame(refreshFrame);
      trigger?.kill();
    };
  }, [still]);

  return (
    <section
      ref={root}
      id="the-ritual"
      className="ritual-sequence"
      data-chapter="ritual"
      data-directed={directed}
      data-active={active}
      aria-labelledby="ritual-title"
    >
      <div className="ritual-sequence-stage">
        <div
          className="ritual-beat ritual-beat-human"
          aria-hidden={directed && active !== 1}
          inert={directed && active !== 1}
        >
          <Image
            src="/media/world/ritual-mirror-v1.webp"
            alt=""
            fill
            sizes="100vw"
            className="ritual-beat-image"
          />
          <div className="ritual-beat-shade" aria-hidden="true" />
          <div className="ritual-beat-copy">
            <p className="estate-eyebrow">05 / THE RITUAL · BEFORE THE DAY</p>
            <h2 id="ritual-title">
              A moment to
              <br />
              <em>take your place.</em>
            </h2>
            <p>The day asks for many things. The first few minutes can still belong to you.</p>
            <Link href="/shop" className="ritual-text-link">
              Explore the collection ↗
            </Link>
          </div>
          <p className="ritual-frame-note">01 / PREPARATION · CAMPAIGN VISUALIZATION</p>
        </div>
        <div
          id="ritual-object"
          className="ritual-beat ritual-beat-object"
          aria-hidden={directed && active !== 2}
          inert={directed && active !== 2}
        >
          <picture>
            <source media="(max-width: 600px)" srcSet="/media/world/ritual-mobile.webp" />
            <Image
              src="/media/world/ritual.webp"
              alt=""
              fill
              sizes="100vw"
              className="ritual-beat-image"
            />
          </picture>
          <div className="ritual-beat-shade" aria-hidden="true" />
          <div className="ritual-beat-copy">
            <p className="estate-eyebrow">LEGACY RESERVE / VITALIS</p>
            <h3>
              Care becomes
              <br />
              <em>something you carry.</em>
            </h3>
            <p>A hair and beard oil taking shape around the daily act of showing up prepared.</p>
            <div className="estate-actions">
              <Link className="estate-primary" href="/shop/vitalis#atelier">
                Inspect Vitalis <span>↗</span>
              </Link>
              <Link href="/shop">Shop the collection ↗</Link>
            </div>
            <small>Concept packaging · final product may differ · not available to order</small>
          </div>
          <p className="ritual-frame-note">02 / THE OBJECT · COLLECTION PREVIEW</p>
        </div>
        {directed && (
          <div className="ritual-progress" aria-hidden="true">
            <span className={active === 2 ? 'is-active' : ''} />
          </div>
        )}
      </div>
    </section>
  );
}
