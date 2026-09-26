'use client';
import Image from 'next/image';
import { useWorldStill } from './cinematic-world';
import { useEffect, useRef, useState } from 'react';

export interface SceneMedia {
  poster: string;
  mobilePoster?: string;
  alt: string;
  credit: string;
  video?: string;
  mobileVideo?: string;
  focalPoint?: string;
}

/** The poster is the composition. Film progressively enhances it after entering view. */
export function MediaScene({
  media,
  priority = false,
  bare = false,
}: {
  media: SceneMedia;
  priority?: boolean;
  bare?: boolean;
}) {
  const worldStill = useWorldStill();
  const host = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const node = host.current;
    let visible = false;
    const sync = () => {
      const active = visible && !motion.matches && !paused && !worldStill && !document.hidden;
      node?.setAttribute('data-still', String(!active));
      if (!film.current) return;
      if (active)
        void film.current
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      else {
        film.current.pause();
        setPlaying(false);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    if (node) observer.observe(node);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [paused, worldStill]);
  return (
    <div ref={host} className={bare ? 'estate-scene-media' : 'world-scene'} data-still="true">
      <picture>
        {media.mobilePoster && <source media="(max-width: 600px)" srcSet={media.mobilePoster} />}
        <Image
          src={media.poster}
          alt={media.alt}
          fill
          sizes={bare ? '(max-width: 600px) 220vw, 100vw' : '100vw'}
          preload={priority}
          style={{ objectPosition: media.focalPoint }}
        />
      </picture>
      {media.video && (
        <video
          ref={film}
          muted
          loop
          playsInline
          preload="none"
          poster={media.poster}
          aria-hidden="true"
          className={playing ? 'is-playing' : ''}
        >
          {media.mobileVideo && (
            <source src={media.mobileVideo} media="(max-width: 600px)" type="video/mp4" />
          )}
          <source src={media.video} type="video/mp4" />
        </video>
      )}
      {!bare && (
        <>
          <div className="scene-shade" />
          <div className="scene-orbit" aria-hidden="true" />
          <div className="scene-caption">
            <span>{media.credit}</span>
            <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
              {paused ? 'Motion on' : 'Pause motion'}{' '}
              <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
