'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { brand } from '@/platform/brand';
import { useAppearance } from '@/components/visual/appearance';

export function Threshold() {
  const router = useRouter();
  const { moving } = useAppearance();
  const [entering, setEntering] = useState(false);
  const root = useRef<HTMLElement>(null);
  const dispose = useRef<(() => void) | null>(null);
  const active = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    router.prefetch('/experience/world');
    return () => {
      active.current = false;
      dispose.current?.();
    };
  }, [router]);
  function finish() {
    active.current = false;
    clearTimeout(timeoutRef.current);
    router.push('/experience/world');
  }
  async function enter() {
    if (active.current) return;
    if (!moving) {
      router.push('/experience/world');
      return;
    }
    active.current = true;
    setEntering(true);
    // Start meaningful asset work alongside the camera, never wait for a video.
    const poster = new window.Image();
    poster.src = '/media/world/observatory.webp';
    void poster.decode().catch(() => {});
    const timeout = window.setTimeout(finish, 2200);
    timeoutRef.current = timeout;
    dispose.current = () => clearTimeout(timeout);
    try {
      const { gsap } = await import('gsap');
      if (!active.current || !root.current) return;
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: finish });
        tl.to('.gw-threshold-copy', { opacity: 0, y: -12, duration: 0.3 })
          .to('.gw-threshold-image', { scale: 1.65, duration: 1.6, ease: 'power2.in' }, 0)
          .fromTo(
            '.gw-crest-flight',
            { opacity: 0, scale: 0.5 },
            { opacity: 1, scale: 1, duration: 0.6 },
            0.2,
          )
          .to('.gw-crest-flight', { scale: 8, opacity: 0, duration: 0.75, ease: 'power3.in' }, 0.8)
          .to('.gw-threshold-veil', { opacity: 1, duration: 0.25 }, 1.4);
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
    if (!moving && active.current) finish();
  });
  return (
    <section className="gw-threshold" ref={root} aria-labelledby="threshold-heading">
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
      <div className="gw-crest-flight" aria-hidden="true">
        <Image src={brand.crest} alt="" width={260} height={260} />
      </div>
      <div className="gw-threshold-veil" aria-hidden="true" />
      <div className="gw-threshold-footer">
        <Link href="/enter">Member sign in</Link>
        <Link
          href="/experience/world"
          onClick={() => {
            active.current = false;
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
