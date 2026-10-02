'use client';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EnergyOrb } from './energy-orb';
import { brand } from '@/platform/brand';
import { useAppearance } from '@/components/visual/appearance';

export function Threshold() {
  const router = useRouter();
  const { moving } = useAppearance();
  const [entering, setEntering] = useState(false);
  const [arrival, setArrival] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const ending = useRef(false);
  const filmStarted = useRef(false);
  const root = useRef<HTMLElement>(null);
  const dispose = useRef<(() => void) | null>(null);
  const active = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    router.prefetch('/experience/world');
    return () => {
      active.current = false;
      clearTimeout(timeoutRef.current);
      dispose.current?.();
    };
  }, [router]);
  function finish() {
    if (!active.current) return;
    active.current = false;
    clearTimeout(timeoutRef.current);
    video.current?.pause();
    try {
      localStorage.setItem('gent-entrance-seen-v1', 'true');
    } catch {}
    router.push('/experience/world');
  }
  async function arrive() {
    if (!active.current || ending.current) return;
    ending.current = true;
    video.current?.pause();
    setArrival(true);
    try {
      const { gsap } = await import('gsap');
      if (!active.current || !root.current) return;
      const ctx = gsap.context(() => {
        gsap
          .timeline({ onComplete: finish })
          .to('.gw-journey', { opacity: 0, duration: 0.8 })
          .fromTo(
            '.gw-cinematic-arrival',
            { opacity: 0, scale: 0.86 },
            { opacity: 1, scale: 1, duration: 1.5, ease: 'sine.out' },
            0.2,
          )
          .to('.gw-threshold-veil', { opacity: 1, duration: 0.5 }, 2.5);
      }, root);
      const previous = dispose.current;
      dispose.current = () => {
        previous?.();
        ctx.revert();
      };
    } catch {
      finish();
    }
  }
  function playFilm() {
    if (!active.current) return;
    const film = video.current;
    if (!film || film.readyState < 2) {
      void arrive();
      return;
    }
    filmStarted.current = true;
    void film.play().catch(() => {
      void arrive();
    });
  }
  async function enter(replay = false) {
    if (active.current) return;
    window.dispatchEvent(new Event('gent-world-enter'));
    let seen = false;
    try {
      seen = localStorage.getItem('gent-entrance-seen-v1') === 'true';
    } catch {}
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    if (!moving || saveData || (seen && !replay)) {
      router.push('/experience/world');
      return;
    }
    active.current = true;
    setEntering(true);
    if (video.current) {
      video.current.preload = 'auto';
      video.current.src = '/media/entrance/collective-journey-v1.mp4';
      video.current.load();
    }
    // Start meaningful asset work alongside the camera, never wait for a video.
    const poster = new window.Image();
    const { props } = getImageProps({
      src: '/media/world/whole-man-chamber-v2.webp',
      alt: '',
      fill: true,
      sizes: '100vw',
    });
    poster.sizes = props.sizes ?? '100vw';
    poster.srcset = props.srcSet ?? '';
    poster.src = props.src;
    void poster.decode().catch(() => {});
    const timeout = window.setTimeout(finish, 20000);
    timeoutRef.current = timeout;
    dispose.current = () => clearTimeout(timeout);
    try {
      const { gsap } = await import('gsap');
      if (!active.current || !root.current) return;
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: playFilm });
        tl.to('.gw-threshold-copy', { opacity: 0, y: -10, duration: 0.45 })
          .to('.gw-threshold-image', { scale: 1.15, duration: 2.8, ease: 'sine.inOut' }, 0)
          .fromTo(
            '.gw-arrival-glow',
            { opacity: 0, scale: 0.65 },
            { opacity: 0.85, scale: 1, duration: 1.3, ease: 'sine.out' },
            0.2,
          )
          .fromTo(
            '.gw-crest-flight',
            { opacity: 0, scale: 0.82 },
            { opacity: 1, scale: 1, duration: 1.2, ease: 'power1.out' },
            0.4,
          )
          .fromTo('.gw-arrival-name', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 1)
          .fromTo(
            '.gw-arrival-sweep',
            { xPercent: -130, opacity: 0 },
            { xPercent: 130, opacity: 0.7, duration: 1.4, ease: 'sine.inOut' },
            0.7,
          )
          .to(
            '.gw-arrival-glow',
            { opacity: 0.55, scale: 1.08, duration: 0.6, yoyo: true, repeat: 1 },
            1.45,
          )
          .to('.gw-crest-flight', { scale: 1.12, duration: 1.15, ease: 'sine.inOut' }, 1.6)
          .to('.gw-arrival-name', { opacity: 0, duration: 0.5 }, 2.75)
          .to('.gw-crest-flight', { scale: 7, opacity: 0, duration: 1.25, ease: 'power3.in' }, 2.75)
          .to('.gw-threshold-image', { scale: 1.8, duration: 1.25, ease: 'power3.in' }, 2.75)
          .to('.gw-arrival-glow', { opacity: 0, scale: 1.6, duration: 0.9 }, 3.1)
          .to('.gw-journey', { opacity: 1, duration: 0.6 }, 3.7);
      }, root);
      dispose.current = () => {
        clearTimeout(timeout);
        ctx.revert();
      };
    } catch {
      finish();
    }
  }
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && active.current) finish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  });
  useEffect(() => {
    if (!moving && active.current) finish();
  });
  return (
    <section
      className="gw-threshold"
      data-entering={entering}
      ref={root}
      aria-labelledby="threshold-heading"
    >
      <picture className="gw-threshold-image">
        <source media="(max-width: 600px)" srcSet="/media/world/threshold-chamber-mobile.webp" />
        <Image src="/media/world/threshold-chamber.webp" alt="" fill sizes="100vw" preload />
      </picture>
      <div className="gw-threshold-shade" />
      <div className="gw-threshold-copy">
        <p className="gw-kicker">THE WHOLE MAN. ONE CONNECTED WORLD.</p>
        <h1 id="threshold-heading" tabIndex={-1}>
          Your life.
          <br />
          <em>More deliberately.</em>
        </h1>
        <p>Care. Direction. Intelligence.</p>
        <Link
          className="gw-enter"
          href="/experience/world"
          onClick={(event) => {
            if (
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              event.preventDefault();
              void enter();
            }
          }}
          aria-disabled={entering}
        >
          ENTER <span aria-hidden="true">↗</span>
        </Link>
        <span className="gw-entry-note">Explore freely. Make it yours when you’re ready.</span>
      </div>
      <div className="gw-arrival-glow" aria-hidden="true" />
      <div className="gw-crest-flight" aria-hidden="true">
        <Image src={brand.crest} alt="" width={260} height={260} preload />
        <span className="gw-arrival-sweep" />
      </div>
      <div className="gw-arrival-name" aria-hidden="true">
        <span>GENT ASCEND</span>
        <small>COLLECTIVE</small>
        <p>Your world is opening.</p>
      </div>
      <div className="gw-journey" aria-hidden="true">
        <div className="gw-journey-field" />
        <video
          ref={video}
          muted
          playsInline
          preload="none"
          onEnded={() => void arrive()}
          onError={() => {
            if (active.current && filmStarted.current) void arrive();
          }}
        />
        <div className="gw-journey-caption">
          <span>LEGACY RESERVE</span>
          <small>Ritual. Refined.</small>
        </div>
      </div>
      <div className="gw-cinematic-arrival" aria-hidden="true">
        <EnergyOrb moving={arrival && moving} />
        <span>AETHELIOS</span>
        <p>Your world. Connected.</p>
      </div>
      <div className="gw-threshold-veil" aria-hidden="true" />
      <div className="gw-threshold-footer">
        <Link href="/enter">Member sign in</Link>
        {!entering && (
          <button type="button" onClick={() => void enter(true)}>
            Replay entrance
          </button>
        )}
        <Link
          href="/experience/world"
          onClick={() => {
            active.current = false;
            clearTimeout(timeoutRef.current);
            video.current?.pause();
            try {
              localStorage.setItem('gent-entrance-seen-v1', 'true');
            } catch {}
            dispose.current?.();
          }}
        >
          Skip entrance →
        </Link>
      </div>
      <span role="status" className="sr-only">
        {entering ? 'Entering your world' : ''}
      </span>
    </section>
  );
}
